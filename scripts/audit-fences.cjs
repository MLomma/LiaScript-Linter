'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const textmate = require('vscode-textmate');
const onig = require('vscode-oniguruma');
const project = path.resolve(__dirname, '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--corpus', '--vscode-extensions', '--output'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Expected --corpus PATH --vscode-extensions PATH --output FILE');
  args[process.argv[i].slice(2)] = path.resolve(process.argv[i + 1]);
}
for (const key of ['corpus', 'vscode-extensions', 'output']) if (!args[key]) throw new Error('Missing --' + key);
const corpus = args.corpus;
const builtin = args['vscode-extensions'];
const customScope = 'text.html.markdown.liascript';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    if (entry.name === '.git' || entry.isSymbolicLink()) continue;
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) result.push(...walk(file));
    else if (/\.md$/i.test(entry.name)) result.push(file);
  }
  return result.sort();
}
function prefix(line) {
  const match = /^(?<quote>(?:[ \t]*>[ \t]?)*)(?<indent>[ \t]*)(?<list>(?:[-+*]|\d+[.)])[ \t]+)?(?<body>.*)$/.exec(line);
  return { body: match.groups.body, quoteDepth: (match.groups.quote.match(/>/g)||[]).length };
}
function stripQuote(line, depth) {
  for (let index=0;index<depth;index++) line=line.replace(/^[ \t]*>[ \t]?/,'');
  return line;
}
function normalScopes(scopes) {
  return scopes.filter(scope => scope !== customScope && scope !== 'text.html.markdown' && !scope.endsWith('.liascript'));
}
(async () => {
  const began = performance.now();
  const mapping = {};
  for (const entry of fs.readdirSync(builtin)) {
    const pkg = path.join(builtin,entry,'package.json');
    if (!fs.existsSync(pkg)) continue;
    for (const item of JSON.parse(fs.readFileSync(pkg,'utf8')).contributes?.grammars || []) {
      if (item.path) mapping[item.scopeName] = path.resolve(path.dirname(pkg),item.path);
    }
  }
  mapping[customScope] = path.join(project,'syntaxes/liascript.tmLanguage.json');
  mapping['liascript.injection'] = path.join(project,'syntaxes/liascript.injection.tmLanguage.json');
  const grammarHash = hash(fs.readFileSync(mapping[customScope]));
  const injectionHash = hash(fs.readFileSync(mapping['liascript.injection']));
  const missingGrammarScopes = new Set();
  const wasm=fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength));
  const registry=new textmate.Registry({
    onigLib:Promise.resolve({createOnigScanner:rules=>new onig.OnigScanner(rules),createOnigString:text=>new onig.OnigString(text)}),
    loadGrammar:async scope=>{
      if (!mapping[scope]) { missingGrammarScopes.add(scope); return null; }
      return textmate.parseRawGrammar(fs.readFileSync(mapping[scope],'utf8'),mapping[scope]);
    },
    getInjections:scope=>scope===customScope?['liascript.injection']:[],
  });
  const current = await registry.loadGrammar(customScope);
  const baseline = await registry.loadGrammar('text.html.markdown');
  const report={generatedAt:new Date().toISOString(),method:'Every complete physical labeled fence, including nested/documented examples and macro titles. Normalize container prefixes; for backtick-quoted titles remove the annotation ONLY from native Markdown baseline. Compare all native embedded body tokens, require fenced scopes on every non-whitespace body token; test heading recovery immediately after closure and heading/quiz/macro recovery after blank lines. Course code is never evaluated.',grammarHash,injectionHash,sources:[],groups:{},files:0,physicalLabeledOpeners:0,quotedInfoBlocks:0,unterminated:[],occurrences:[],mismatches:[],bodyScopeFailures:[],recoveryFailures:[],earlyStops:[],errors:[]};
  for (const name of ['ghrepo-mint-the-gap-aufgabensammlung-5f878df9ed','ghrepo-mint-the-gap-wochenaufgabe-66366d21e5']) {
    const source=path.join(corpus,'sources',name);
    const meta=JSON.parse(fs.readFileSync(path.join(source,'source.json'),'utf8'));
    const filesRoot=path.join(source,'files');
    const files=walk(filesRoot);
    report.sources.push({sourceId:meta.source_id,revision:meta.revision_sha,files:files.length});
    for (const file of files) {
      report.files++;
      const lines=fs.readFileSync(file,'utf8').replace(/\r\n|\r/g,'\n').split('\n');
      const relative=path.relative(filesRoot,file).split(path.sep).join('/');
      for (let start=0;start<lines.length;start++) {
        const p=prefix(lines[start]);
        const open=/^([\x60]{3,}|~{3,})[ \t]*([a-zA-Z][\w.+#-]*)(.*)$/.exec(p.body);
        if (!open) continue;
        report.physicalLabeledOpeners++;
        const quotedInfo = open[3].includes(String.fromCharCode(96));
        if (quotedInfo) report.quotedInfoBlocks++;
        const fence=open[1], language=open[2].toLowerCase();
        let end=start+1;
        const closing=new RegExp('^[ \\t]*'+(fence[0]==='`'?'`':'~')+'{'+fence.length+',}[ \\t]*$');
        while(end<lines.length && !closing.test(stripQuote(lines[end],p.quoteDepth))) end++;
        if(end===lines.length) { report.unterminated.push({sourceId:meta.source_id,path:relative,line:start+1,language}); continue; }
        const annotation=/^[ \t]+@[\w]/.test(open[3]);
        const key=language+(annotation?' annotated':' plain');
        const group=report.groups[key] ||= {blocks:0,bodyLines:0,embeddedTokenPositions:0,blocksWithBaselineEmbedding:0,blocksWithoutBaselineEmbedding:0,mismatchBlocks:0};
        const occurrence={sourceId:meta.source_id,path:relative,startLine:start+1,endLine:end+1,language,annotation,quotedInfo,bodyLines:end-start-1,embeddedTokens:0,missingTokenPositions:0};
        group.blocks++; group.bodyLines+=occurrence.bodyLines;
        let currentStack=textmate.INITIAL, baselineStack=textmate.INITIAL;
        for(let row=start;row<=end;row++) {
          const text=row===start?p.body:stripQuote(lines[row],p.quoteDepth);
          const baselineText = row === start && quotedInfo ? fence + language : text;
          const a=current.tokenizeLine(text,currentStack,200), b=baseline.tokenizeLine(baselineText,baselineStack,200);
          currentStack=a.ruleStack; baselineStack=b.ruleStack;
          if(a.stoppedEarly||b.stoppedEarly) report.earlyStops.push({path:relative,line:row+1,current:a.stoppedEarly,baseline:b.stoppedEarly});
          if(row===start||row===end) continue;
          if (a.tokens.some(token => text.slice(token.startIndex, token.endIndex).trim() && !token.scopes.includes('markup.fenced_code.block.markdown'))) report.bodyScopeFailures.push({sourceId:meta.source_id,path:relative,line:row+1,language,quotedInfo});
          for(const expected of b.tokens) {
            if(!expected.scopes.some(scope=>/^meta\.embedded\.block\./.test(scope))) continue;
            if(!text.slice(expected.startIndex,expected.endIndex).trim()) continue;
            occurrence.embeddedTokens++;group.embeddedTokenPositions++;
            const expectedScopes=normalScopes(expected.scopes);
            const overlapping=a.tokens.filter(token=>token.startIndex<expected.endIndex && token.endIndex>expected.startIndex);
            const missing=overlapping.filter(token=>expectedScopes.some(scope=>!normalScopes(token.scopes).includes(scope)));
            if(!overlapping.length||missing.length) {
              occurrence.missingTokenPositions++;
              if(occurrence.missingTokenPositions<=5) report.mismatches.push({sourceId:meta.source_id,path:relative,line:row+1,column:expected.startIndex+1,language,annotation,expected:expectedScopes,actual:overlapping.map(token=>normalScopes(token.scopes)),text:text.slice(0,180)});
            }
          }
        }
        const forbidden = /(?:markup\.(?:fenced_code|raw)|macro-argument|meta\.macro-call)/;
        const immediate = current.tokenizeLine('# ImmediateFenceEnd_913c', currentStack, 200);
        const immediateToken = immediate.tokens.find(token => token.startIndex <= 2 && token.endIndex > 2);
        if (immediate.stoppedEarly) report.earlyStops.push({path:relative,probe:'immediate'});
        if (!immediateToken?.scopes.some(scope => /heading/.test(scope)) || immediateToken?.scopes.some(scope => forbidden.test(scope))) report.recoveryFailures.push({sourceId:meta.source_id,path:relative,startLine:start+1,probe:'immediate-heading',quotedInfo});
        const probes = ['', '', '# FenceAuditEnd_913c', '', '[(X)] FenceAuditAnswer_913c', '', '@FenceAuditMacro_913c(ok)'];
        for (let index = 0; index < probes.length; index++) {
          const result = current.tokenizeLine(probes[index], currentStack, 200);
          currentStack = result.ruleStack;
          if (result.stoppedEarly) report.earlyStops.push({path:relative,probe:index});
          const patterns = {2:/heading/,4:/(?:quiz|choice)\..*liascript$/,6:/entity.name.function.*liascript$/};
          if (patterns[index]) {
            const recovered = result.tokens.some(token => {
              const expected = token.scopes.some(scope => patterns[index].test(scope));
              const blocked = token.scopes.some(scope => forbidden.test(scope) && !(index === 6 && scope === 'meta.macro-call.liascript'));
              return expected && !blocked;
            });
            if (!recovered) report.recoveryFailures.push({sourceId:meta.source_id,path:relative,startLine:start+1,probe:index,quotedInfo});
          }
        }
        if(occurrence.embeddedTokens) group.blocksWithBaselineEmbedding++;
        else group.blocksWithoutBaselineEmbedding++;
        if(occurrence.missingTokenPositions) group.mismatchBlocks++;
        report.occurrences.push(occurrence);
      }
    }
  }
  report.missingGrammarScopes=[...missingGrammarScopes].sort();
  report.grammarChangedDuringAudit=grammarHash!==hash(fs.readFileSync(mapping[customScope]))||injectionHash!==hash(fs.readFileSync(mapping['liascript.injection']));
  report.summary={files:report.files,labeledOpeners:report.physicalLabeledOpeners,quotedInfoBlocks:report.quotedInfoBlocks,completeBlocks:report.occurrences.length,unterminated:report.unterminated.length,bodyLines:report.occurrences.reduce((sum,item)=>sum+item.bodyLines,0),baselineEmbeddedTokenPositions:report.occurrences.reduce((sum,item)=>sum+item.embeddedTokens,0),blocksWithBaselineEmbedding:report.occurrences.filter(item=>item.embeddedTokens).length,blocksWithoutBaselineEmbedding:report.occurrences.filter(item=>!item.embeddedTokens).length,blocksWithMissingNativeScopes:report.occurrences.filter(item=>item.missingTokenPositions).length,positionsWithMissingNativeScopes:report.occurrences.reduce((sum,item)=>sum+item.missingTokenPositions,0),bodyScopeFailures:report.bodyScopeFailures.length,recoveryFailures:report.recoveryFailures.length,earlyStops:report.earlyStops.length,elapsedMs:Math.round(performance.now()-began)};
  fs.mkdirSync(path.dirname(args.output), {recursive:true});
  fs.writeFileSync(args.output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.summary,null,2));
  console.log(JSON.stringify(report.groups,null,2));
  console.log('Grammar changed during audit: '+report.grammarChangedDuringAudit);
  registry.dispose();
  if(report.earlyStops.length||report.grammarChangedDuringAudit||report.unterminated.length||report.bodyScopeFailures.length||report.recoveryFailures.length||report.mismatches.length) process.exitCode=2;
})().catch(error=>{console.error(error);process.exitCode=2;});