# Tokenizer test fixtures

These unmodified JSON grammars are test data, copied from the local VS Code 1.137.0 installation. They let the tests run offline on any platform, with the same real Markdown and embedded language grammars used by the editor. They are excluded from the packaged extension; at runtime the extension uses VS Code's installed grammars.

| File | Upstream revision | License notice |
| --- | --- | --- |
| markdown.tmLanguage.json | [microsoft/vscode-markdown-tm-grammar, 0812fc4b190efc17bfed0d5b4ff918eff8e4e377](https://github.com/microsoft/vscode-markdown-tm-grammar/commit/0812fc4b190efc17bfed0d5b4ff918eff8e4e377) | markdown-LICENSE.txt (MIT) |
| JavaScript.tmLanguage.json | [microsoft/TypeScript-TmLanguage, 48f608692aa6d6ad7bd65b478187906c798234a8](https://github.com/microsoft/TypeScript-TmLanguage/commit/48f608692aa6d6ad7bd65b478187906c798234a8) | javascript-LICENSE.txt (MIT) |
| css.tmLanguage.json | [microsoft/vscode-css, de9e6beee756760f31b15efbd782735fc25de3db](https://github.com/microsoft/vscode-css/commit/de9e6beee756760f31b15efbd782735fc25de3db) | css-LICENSE.txt (MIT) |
| LaTeX.tmLanguage.json | [jlelong/vscode-latex-basics, 843cd14021feb45069fac66c6e1f98e02a196dea](https://github.com/jlelong/vscode-latex-basics/commit/843cd14021feb45069fac66c6e1f98e02a196dea) | latex-LICENSE.txt (MIT) |
| TeX.tmLanguage.json | [jlelong/vscode-latex-basics, 76dc409348227db00f6779772f7763dc90cdf22e](https://github.com/jlelong/vscode-latex-basics/commit/76dc409348227db00f6779772f7763dc90cdf22e) | latex-LICENSE.txt (MIT) |
| html.tmLanguage.json | [textmate/html.tmbundle, 0c3d5ee54de3a993f747f54186b73a4d2d3c44a2](https://github.com/textmate/html.tmbundle/commit/0c3d5ee54de3a993f747f54186b73a4d2d3c44a2) | html-LICENSE.txt (upstream README including its license) |
| html-derivative.tmLanguage.json | [textmate/html.tmbundle, 390c8870273a2ae80244dae6db6ba064a802f407](https://github.com/textmate/html.tmbundle/commit/390c8870273a2ae80244dae6db6ba064a802f407) | html-LICENSE.txt (upstream README including its license) |

The JSON files retain their own upstream version and contributor information. Other programming languages in Markdown fences are resolved by VS Code at runtime and are outside the fixture set.

LiaScript syntax itself was checked against [LiaScript/docs README.md at 268a01bafc48fc4f1b07a5d78817f3c9212a49dd](https://github.com/LiaScript/docs/blob/268a01bafc48fc4f1b07a5d78817f3c9212a49dd/README.md): quizzes at lines 3523-3805, animations at 5799-5929, and macros at 9768-9891.
