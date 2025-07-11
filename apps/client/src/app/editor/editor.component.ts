import { AfterViewInit, Component, ElementRef, OnInit, signal, ViewChild } from '@angular/core';
import * as monaco from 'monaco-editor';
import { RendererComponent } from "../renderer/renderer.component";
import { ChatComponent } from "../chat/chat.component";

@Component({
  selector: 'app-editor',
  imports: [RendererComponent, ChatComponent],
  templateUrl: './editor.component.html',
})
export class EditorComponent implements OnInit, AfterViewInit {
  editor!: monaco.editor.IStandaloneCodeEditor;
  worker = new Worker(new URL('../workers/openscad.worker', import.meta.url))
  currentStl = signal<Uint8Array | null>(null);
  @ViewChild('editorContainer', { static: true }) _editorContainer!: ElementRef;

  constructor() {
    this.worker.onmessage = ({ data }) => {
      this.currentStl.set(data.stlBytes);
    };
  }

  ngOnInit() {
    monaco.languages.register({
      id: 'openscad',
      aliases: ['OpenSCAD', 'openscad'],
      extensions: ['.scad'],
      mimetypes: ['text/x-openscad']
    });
    monaco.languages.setMonarchTokensProvider('openscad', openscadLanguage);
    monaco.languages.setLanguageConfiguration('openscad', openscadLanguageConfig);
    monaco.languages.registerCompletionItemProvider('openscad', openscadCompletionProvider);
    this.editor = monaco.editor.create(this._editorContainer.nativeElement, {
      value: '// OpenSCAD code example\n\nmodule cubeWithHole() {\n  difference() {\n    cube([10, 10, 10]);\n    translate([5, 5, 0]) cylinder(r=3, h=10);\n  }\n}\ncubeWithHole();',
      automaticLayout: true,
      language: 'openscad',
      theme: 'vs-dark',
    });

    this.worker.postMessage({ scadCode: this.editor.getValue() });
  }

  ngAfterViewInit(): void {
    // Ensure the editor is properly sized after view initialization
    this.editor.layout();
  }

  onCodeReceived(code: string | undefined) {
    if (code) {
      this.editor.setValue(code);
      this.worker.postMessage({ scadCode: code });
    }
  }

  saveStl() {
    const bytes = this.currentStl();
    if (bytes) {
      const blob = new Blob([bytes], { type: 'application/sla' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'model.stl';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      console.error('No STL data available to save.');
    }
  }

  render() {
    const code = this.editor.getValue();
    this.worker.postMessage({ scadCode: code });
  }
}

// OpenSCAD Monarch Tokens Provider and Language Configuration
// For use with Monaco Editor

export const openscadLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'] as [string, string]
  },
  brackets: [
    ['{', '}'] as [string, string],
    ['[', ']'] as [string, string],
    ['(', ')'] as [string, string]
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*//\\s*#?region\\b'),
      end: new RegExp('^\\s*//\\s*#?endregion\\b')
    }
  }
};

export const openscadLanguage = {
 // Set defaultToken to invalid to see what's missing
  defaultToken: 'invalid',

  keywords: [
    // Control structures
    'if', 'else', 'for', 'intersection_for', 'let', 'assert', 'echo',
    // Module/function keywords
    'module', 'function', 'use', 'include',
    // Special variables
    'undef', 'true', 'false'
  ],

  // 3D primitives
  primitives3d: [
    'cube', 'sphere', 'cylinder', 'polyhedron', 'hull', 'minkowski'
  ],

  // 2D primitives
  primitives2d: [
    'square', 'circle', 'polygon', 'text', 'import', 'projection'
  ],

  // Transformations
  transformations: [
    'translate', 'rotate', 'scale', 'resize', 'mirror', 'color',
    'linear_extrude', 'rotate_extrude', 'offset'
  ],

  // Boolean operations
  booleans: [
    'union', 'difference', 'intersection', 'render'
  ],

  // Built-in functions
  builtins: [
    // Math functions
    'abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'exp', 'floor',
    'ln', 'log', 'max', 'min', 'norm', 'pow', 'rands', 'round', 'sign',
    'sin', 'sqrt', 'tan',
    // String functions
    'chr', 'ord', 'str', 'len', 'search',
    // List functions
    'concat', 'lookup', 'reverse', 'sort', 'cross'
  ],

  // Special variables
  specialVars: [
    '$children', '$t', '$vpr', '$vpt', '$vpd', '$vpf', '$fa', '$fs', '$fn',
    '$preview', '$parent_modules'
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
    '%=', '<<=', '>>=', '>>>='
  ],

  // Common regular expressions
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  // Tokenizer rules
  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, 'comment'] as monaco.languages.IMonarchLanguageRule,
      [/\/\*/, 'comment', '@comment'] as monaco.languages.IMonarchLanguageRule,

      // Keywords
      [/\b(?:if|else|for|intersection_for|let|assert|echo|module|function|use|include|undef|true|false)\b/, 'keyword'] as monaco.languages.IMonarchLanguageRule,

      // 3D primitives
      [/\b(?:cube|sphere|cylinder|polyhedron|hull|minkowski)\b/, 'keyword.primitive3d'] as monaco.languages.IMonarchLanguageRule,

      // 2D primitives
      [/\b(?:square|circle|polygon|text|import|projection)\b/, 'keyword.primitive2d'] as monaco.languages.IMonarchLanguageRule,

      // Transformations
      [/\b(?:translate|rotate|scale|resize|mirror|color|linear_extrude|rotate_extrude|offset)\b/, 'keyword.transformation'] as monaco.languages.IMonarchLanguageRule,

      // Boolean operations
      [/\b(?:union|difference|intersection|render)\b/, 'keyword.boolean'] as monaco.languages.IMonarchLanguageRule,

      // Built-in functions
      [/\b(?:abs|acos|asin|atan|atan2|ceil|cos|exp|floor|ln|log|max|min|norm|pow|rands|round|sign|sin|sqrt|tan|chr|ord|str|len|search|concat|lookup|reverse|sort|cross)\b/, 'keyword.builtin'] as monaco.languages.IMonarchLanguageRule,

      // Special variables
      [/\$[a-zA-Z_]\w*/, 'variable.special'] as monaco.languages.IMonarchLanguageRule,

      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'] as monaco.languages.IMonarchLanguageRule,
      [/0[xX][0-9a-fA-F]+/, 'number.hex'] as monaco.languages.IMonarchLanguageRule,
      [/\d+/, 'number'] as monaco.languages.IMonarchLanguageRule,

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'] as monaco.languages.IMonarchLanguageRule, // non-terminated string
      [/"/, 'string', '@string_double'] as monaco.languages.IMonarchLanguageRule,
      [/'([^'\\]|\\.)*$/, 'string.invalid'] as monaco.languages.IMonarchLanguageRule, // non-terminated string
      [/'/, 'string', '@string_single'] as monaco.languages.IMonarchLanguageRule,

      // Identifiers
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@primitives3d': 'keyword.primitive3d',
          '@primitives2d': 'keyword.primitive2d',
          '@transformations': 'keyword.transformation',
          '@booleans': 'keyword.boolean',
          '@builtins': 'keyword.builtin',
          '@default': 'identifier'
        }
      }] as monaco.languages.IMonarchLanguageRule,

      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'] as monaco.languages.IMonarchLanguageRule,
      [/[<>](?!@symbols)/, '@brackets'] as monaco.languages.IMonarchLanguageRule,
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }] as monaco.languages.IMonarchLanguageRule,

      // Whitespace
      [/[ \t\r\n]+/, 'white'] as monaco.languages.IMonarchLanguageRule,
      [/\/\*/, 'comment', '@comment'] as monaco.languages.IMonarchLanguageRule,
      [/\/\/.*$/, 'comment'] as monaco.languages.IMonarchLanguageRule
    ],

    comment: [
      [/[^\/*]+/, 'comment'] as monaco.languages.IMonarchLanguageRule,
      [/\/\*/, 'comment', '@push'] as monaco.languages.IMonarchLanguageRule,
      [/\*\//, 'comment', '@pop'] as monaco.languages.IMonarchLanguageRule,
      [/[\/*]/, 'comment'] as monaco.languages.IMonarchLanguageRule
    ],

    string_double: [
      [/[^\\"]+/, 'string'] as monaco.languages.IMonarchLanguageRule,
      [/\\./, 'string.escape.invalid'] as monaco.languages.IMonarchLanguageRule,
      [/"/, 'string', '@pop'] as monaco.languages.IMonarchLanguageRule
    ],

    string_single: [
      [/[^\\']+/, 'string'] as monaco.languages.IMonarchLanguageRule,
      [/\\./, 'string.escape.invalid'] as monaco.languages.IMonarchLanguageRule,
      [/'/, 'string', '@pop'] as monaco.languages.IMonarchLanguageRule
    ]
  }
};

export const openscadCompletionProvider: monaco.languages.CompletionItemProvider = {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };

    const suggestions: monaco.languages.CompletionItem[] = [
      // 3D Primitives
      {
        label: 'cube',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'cube([${1:10}, ${2:10}, ${3:10}], center=${4:false});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a cube with specified dimensions',
        detail: 'cube([x, y, z], center=false)',
        range: range
      },
      {
        label: 'sphere',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'sphere(r=${1:5}, $fn=${2:32});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a sphere with specified radius',
        detail: 'sphere(r=radius, $fn=fragments)',
        range: range
      },
      {
        label: 'cylinder',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'cylinder(h=${1:10}, r=${2:5}, center=${3:false}, $fn=${4:32});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a cylinder with specified height and radius',
        detail: 'cylinder(h=height, r=radius, center=false)',
        range: range
      },
      {
        label: 'polyhedron',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'polyhedron(points=[${1:[[0,0,0], [1,0,0], [0,1,0], [0,0,1]]}], faces=[${2:[[0,1,2], [0,1,3], [0,2,3], [1,2,3]]}]);',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a polyhedron from points and faces',
        detail: 'polyhedron(points=[], faces=[])',
        range: range
      },

      // 2D Primitives
      {
        label: 'square',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'square([${1:10}, ${2:10}], center=${3:false});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a square with specified dimensions',
        detail: 'square([x, y], center=false)',
        range: range
      },
      {
        label: 'circle',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'circle(r=${1:5}, $fn=${2:32});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a circle with specified radius',
        detail: 'circle(r=radius, $fn=fragments)',
        range: range
      },
      {
        label: 'polygon',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'polygon(points=[${1:[[0,0], [1,0], [1,1], [0,1]]}]);',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates a polygon from points',
        detail: 'polygon(points=[])',
        range: range
      },
      {
        label: 'text',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'text("${1:Hello}", size=${2:10}, font="${3:Liberation Sans}");',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates text as a 2D shape',
        detail: 'text(text, size=10, font="Liberation Sans")',
        range: range
      },

      // Transformations
      {
        label: 'translate',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'translate([${1:0}, ${2:0}, ${3:0}]) {\n\t${4:// your object here}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Translates (moves) an object',
        detail: 'translate([x, y, z])',
        range: range
      },
      {
        label: 'rotate',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'rotate([${1:0}, ${2:0}, ${3:0}]) {\n\t${4:// your object here}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Rotates an object around axes',
        detail: 'rotate([x, y, z]) or rotate(angle, [x, y, z])',
        range: range
      },
      {
        label: 'scale',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'scale([${1:1}, ${2:1}, ${3:1}]) {\n\t${4:// your object here}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Scales an object by specified factors',
        detail: 'scale([x, y, z])',
        range: range
      },
      {
        label: 'mirror',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'mirror([${1:1}, ${2:0}, ${3:0}]) {\n\t${4:// your object here}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Mirrors an object across a plane',
        detail: 'mirror([x, y, z])',
        range: range
      },
      {
        label: 'color',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'color("${1:red}") {\n\t${2:// your object here}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Colors an object',
        detail: 'color(colorname) or color([r, g, b, a])',
        range: range
      },

      // Boolean Operations
      {
        label: 'union',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'union() {\n\t${1:// objects to unite}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Combines multiple objects into one',
        detail: 'union()',
        range: range
      },
      {
        label: 'difference',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'difference() {\n\t${1:// base object}\n\t${2:// objects to subtract}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Subtracts objects from the first object',
        detail: 'difference()',
        range: range
      },
      {
        label: 'intersection',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'intersection() {\n\t${1:// objects to intersect}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates intersection of multiple objects',
        detail: 'intersection()',
        range: range
      },

      // Extrusion Operations
      {
        label: 'linear_extrude',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'linear_extrude(height=${1:10}, twist=${2:0}, slices=${3:20}) {\n\t${4:// 2D shape to extrude}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Extrudes a 2D shape linearly',
        detail: 'linear_extrude(height, twist=0, slices=20)',
        range: range
      },
      {
        label: 'rotate_extrude',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'rotate_extrude(angle=${1:360}, $fn=${2:32}) {\n\t${3:// 2D shape to revolve}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Revolves a 2D shape around the Z-axis',
        detail: 'rotate_extrude(angle=360, $fn=32)',
        range: range
      },

      // Control Structures
      {
        label: 'if',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'if (${1:condition}) {\n\t${2:// code}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Conditional statement',
        detail: 'if (condition)',
        range: range
      },
      {
        label: 'for',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'for (${1:i} = [${2:0} : ${3:1} : ${4:10}]) {\n\t${5:// code}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'For loop',
        detail: 'for (variable = [start : step : end])',
        range: range
      },
      {
        label: 'intersection_for',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'intersection_for (${1:i} = [${2:0} : ${3:1} : ${4:10}]) {\n\t${5:// code}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Intersection for loop',
        detail: 'intersection_for (variable = [start : step : end])',
        range: range
      },

      // Module Definition
      {
        label: 'module',
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: 'module ${1:name}(${2:parameters}) {\n\t${3:// module body}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Define a reusable module',
        detail: 'module name(parameters)',
        range: range
      },

      // Function Definition
      {
        label: 'function',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'function ${1:name}(${2:parameters}) = ${3:expression};',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Define a function',
        detail: 'function name(parameters) = expression',
        range: range
      },

      // Math Functions
      {
        label: 'sin',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'sin(${1:angle})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Sine function (angle in degrees)',
        detail: 'sin(angle)',
        range: range
      },
      {
        label: 'cos',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'cos(${1:angle})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Cosine function (angle in degrees)',
        detail: 'cos(angle)',
        range: range
      },
      {
        label: 'tan',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'tan(${1:angle})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Tangent function (angle in degrees)',
        detail: 'tan(angle)',
        range: range
      },
      {
        label: 'sqrt',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'sqrt(${1:value})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Square root function',
        detail: 'sqrt(value)',
        range: range
      },
      {
        label: 'pow',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'pow(${1:base}, ${2:exponent})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Power function',
        detail: 'pow(base, exponent)',
        range: range
      },
      {
        label: 'abs',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'abs(${1:value})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Absolute value function',
        detail: 'abs(value)',
        range: range
      },
      {
        label: 'max',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'max(${1:values})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Maximum value from list or arguments',
        detail: 'max(values...)',
        range: range
      },
      {
        label: 'min',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'min(${1:values})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Minimum value from list or arguments',
        detail: 'min(values...)',
        range: range
      },

      // List Functions
      {
        label: 'len',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'len(${1:list})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Returns length of list or string',
        detail: 'len(list)',
        range: range
      },
      {
        label: 'concat',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'concat(${1:list1}, ${2:list2})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Concatenates lists',
        detail: 'concat(list1, list2, ...)',
        range: range
      },

      // Special Variables
      {
        label: '$fn',
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: '$fn',
        documentation: 'Number of fragments for circular objects',
        detail: 'Special variable: fragment number',
        range: range
      },
      {
        label: '$fa',
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: '$fa',
        documentation: 'Fragment angle for circular objects',
        detail: 'Special variable: fragment angle',
        range: range
      },
      {
        label: '$fs',
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: '$fs',
        documentation: 'Fragment size for circular objects',
        detail: 'Special variable: fragment size',
        range: range
      },
      {
        label: '$t',
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: '$t',
        documentation: 'Animation time variable (0-1)',
        detail: 'Special variable: animation time',
        range: range
      },
      {
        label: '$children',
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: '$children',
        documentation: 'Number of child objects in current module',
        detail: 'Special variable: children count',
        range: range
      },

      // Common Snippets
      {
        label: 'hull',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'hull() {\n\t${1:// objects to hull}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates convex hull of child objects',
        detail: 'hull()',
        range: range
      },
      {
        label: 'minkowski',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'minkowski() {\n\t${1:// objects for minkowski sum}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Creates Minkowski sum of child objects',
        detail: 'minkowski()',
        range: range
      },
      {
        label: 'echo',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'echo("${1:message}", ${2:variables});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Prints debug information to console',
        detail: 'echo(message, variables...)',
        range: range
      },

      // File Operations
      {
        label: 'use',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'use <${1:filename.scad}>;',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Import modules from another file',
        detail: 'use <filename>',
        range: range
      },
      {
        label: 'include',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'include <${1:filename.scad}>;',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Include entire file content',
        detail: 'include <filename>',
        range: range
      }
    ];

    return { suggestions };
  }
};

