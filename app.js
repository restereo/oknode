const { exec, spawn } = require('child_process')

const fs = require('fs')

// parsing
const acorn = require('acorn')
const { parsePackage } = require('parse-package')

// _
const _ = require('underscore')
const R = require('ramda')
const _read = (file) => fs.readFileSync(file, 'utf-8')
// const _write = content => file => fs.witeFileSync(file, content)

const parse_error = e => {

  const lines = e.split(`\n`)

  // return R.merge

  return {
    f : R.zipObj(['name', 'line'], lines[0].split(':')),
    e : R.zipObj(['type', 'text'], lines[4].split('Error: '))
  }

}
//// FUNCTIONS

const get_dependencies = () => _.keys(parsePackage('./package.json').parsed.data.dependencies)

const list_vars = R.compose(
  R.flatten,
  R.map(n=>n.declarations.map(m=>m.id.name)),
  R.filter(t=>t['type'] == 'VariableDeclaration')
  )

const get_vars = file => list_vars(acorn.parse(_read(file)).body)

const prepend = (f, str) => fs.writeFileSync(f,  str + '\n' + _read(f), 'utf-8')

const add_module = (v, file) => prepend(file, `const ${v} = require('${v}') //✓`)

const similar = a => b => {
  return R.symmetricDifference(a, b).length < 3 // 3 is magic
}

const find_typo = (varname, file)=> get_vars(file).find(similar(varname))

const fix_typo = (varname, typo, file, line)=>{

  const lines = _read(file).split(`\n`)

  lines[line-1] = lines[line-1].replace(varname, typo)
    // + ` //✓ ${varname} -->> ${typo}`

  return fs.writeFileSync(file,  lines.join(`\n`), 'utf-8')
}

const fix_line = fixer=>f=>{

  const {line, name} = f
  const lines  = _read(name).split(`\n`)

  lines[line-1] = fixer(lines[line-1])

  fs.writeFileSync(name, lines.join(`\n`), 'utf-8')

  return lines[line-1]
}

const fix_function_def = fix_line(s=>s.replace('=>', '() =>'))
   // + ` //✓ => -->> () =>`)

const add_closing_parenthesis = fix_line(s=>s+`) //✓`)


// check this out
const check = error => test => pos => error.indexOf(test)>-1 && error.split(test)[pos]

/// ENGINE


const run=()=>setTimeout(_run, 0) // INHALE

const _run = () =>{

  const _process = spawn('node', ['test.js']);

  _process.stdout.on('data', d=>console.log(d.toString()));

  let error = ''

  _process.stderr.on('data', data => error+=data);

  _process.on('close', (code) => {

    if (code == 0 || code == null) {return;}

    const {e, f} = parse_error(error);

    console.log(`ERROR: ${e.text} IN FILE: ${f.name}`);

    // console.log(e);

    const _c = check(e.text)


    /* 1 */
    const m_name = _c('Cannot find module ')(1)

    if (m_name) {

      if (m_name.indexOf('/')>-1) {  // local
        return;
      }

      console.log(`INSTALLING ${m_name}`);

      exec(`npm install --save ${m_name}`, (e, stdout, stderr)=>{
        if (!e) {
          return run();
        }
      });

      return;

    }

    /* 2 */
    const v = _c(' is not defined')(0)

    if (v) {

      const deps = get_dependencies().concat(['fs', 'path'])

      if (deps.includes(v)) {
        add_module(v, f.name);
        console.log(`+ ${v} initialize`);
        return run();
      }

      if (v == '_') {
        for (_v of ['underscore', 'lodash']) {
          if (deps.includes(_v)) {
            prepend(f.name, `const _ = require('${_v}')`)
            console.log(`+ ${_v} initialize`);
            return run()
          }
        }
      }


      const typo = find_typo(v, f.name);

      if (typo) {
        fix_typo(v, typo, f.name, f.line);
        console.log(`fixing TYPO: ${v} -->> ${typo}`);
        return run();
      }
    }

    /* 3 */
    const naf = _c(' is not a function')(0)

    if (naf=='undefined') {

    } else {

    }

    /* 4 */
    const u_tok = _c('Unexpected token ')(1)

    if (u_tok == '=>') {
      const fixed_line = fix_function_def(f)
      console.log(`fixing function definition: ${fixed_line}`);
      return run();
    }

    /* 5 */
    const missing = _c(' after argument list')(0)

    if (missing) {
      const missing_symbol = missing.split('missing ')[1]

      if (missing_symbol == ')') {

        add_closing_parenthesis(f);
        console.log(`adding closing parenthesis in line ${f.line} of ${f.name.split(__dirname)[1]}`);
        return run()
      }
    }

    /* 6 */




    // TODO:
      // }
      // ^
      // SyntaxError: missing ) after argument list
      // this is callback lazy-print

    // TODO: missing ) after arguments list
    // TODO:
      // },
      //  ^
      // SyntaxError: Unexpected token ,
      // last element in json


    // TODO: search for github for unfinished consts

    // TODO: little refactoring

    // TODO: Identifier 'underscore' has already been declared

    console.log({error: e.text, file: f.name.split(__dirname)[1], line: f.line});

    console.log('✗');

    // process.exit()

  })

  // process.stdin.resume();

  process.on('SIGINT',(code) => {
    // console.log(code);
    console.log('\nBye');
    process.exit();
  })
}



/// ACTION

run()
