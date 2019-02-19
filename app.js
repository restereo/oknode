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

    const error = e.toString();

    const stacktrace    = error.toString().split('at ')
    const errs          = error.toString().split('Error: ')


    const err = errs[1].split(`\n`)[0]

    const files = stacktrace.filter(l=>l.indexOf(__dirname)>0).map(l=>l.split(')')[0].split('(')[1].split(':')).map(l=>{return {
        'file': l[0], 'line':l[1], column: l[2]}})

    return {err, files}

}


// TODO: join two functions
const parse_error2 = e => {

    const lines = e.split(`\n`)

    // return R.merge

    return {
        f : R.zipObj(['name', 'line'], lines[0].split(':')),
        e : R.zipObj(['type', 'text'], lines[4].split('Error: '))
    }

}
//// FUNCTIONS

const in_dependencies = (varname) => {

    const deps = _.keys(parsePackage('./package.json').parsed.data.dependencies);

    return deps.indexOf(varname) > -1
}

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

    lines[line-1] = lines[line-1].replace(new RegExp(varname,'g'), typo)
        + ` //✓ ${varname} -->> ${typo}`

    return fs.writeFileSync(file,  lines.join(`\n`), 'utf-8')
}

const fix_line = fixer=>f=>{

    const {line, name} = f
    const lines  = _read(name).split(`\n`)

    lines[line-1] = fixer(lines[line-1])

    fs.writeFileSync(name, lines.join(`\n`), 'utf-8')

    return lines[line-1]
}

const fix_function_def = fix_line(s=>s.replace(new RegExp('=>','g'), '() =>') + ` //✓ => -->> () =>`)

const add_closing_parenthesis = fix_line(s=>s+`) //✓`)


// check this out
const check = error => test => pos => {

    if (error.indexOf(test)>-1) {
        const keyword = error.split(test)[pos]
        return keyword;
    } else {

        return false
    }

}

/// ENGINE


const run=()=>setTimeout(_run, 0) // INHALE

const _run = () =>{

    const _process = spawn('node', ['test.js']);

    _process.stdout.on('data', d=>console.log(d.toString()));

    let error = ''

    _process.stderr.on('data', data => error+=data);

    _process.on('close', (code) => {

        if (code == 0 || code == null) {return;}

        const {err, files} = parse_error(error);

        const file = files[0] && files[0].file // we assume error in this file

        const {e, f} = parse_error2(error);

        if (!err || !file) {

            console.log(`ERROR: ${e.text} IN FILE: ${f.name}`);

        } else {

            console.log(`ERROR: ${err} IN FILE: ${file}`);
        }

        // console.log(e);

        const _c = check(e.text)

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

        const v = _c(' is not defined')(0)

        if (v) {

            if (in_dependencies(v)) {
                add_module(v, file);
                console.log(`+ ${v} initialize`);
                return run();
            }

            const typo = find_typo(v, file);

            if (typo) {
                fix_typo(v, typo, file, files[0].line);
                console.log(`fixing TYPO: ${v} -->> ${typo}`);
                return run();
            }
        }

        const naf = _c(' is not a function')(0)

        if (naf=='undefined') {

        } else {

        }

        const u_tok = _c('Unexpected token ')(1)

        if (u_tok == '=>') {
            const fixed_line = fix_function_def(f)
            console.log(`fixing function definition: ${fixed_line}`);
            return run();
        }

        if (u_tok == ',') { // last element in json

            // console.log(e);
            // console.log(err);
        }

        const missing = _c(' after argument list')(0)

        if (missing) {
            const missing_symbol = missing.split('missing ')[1]

            if (missing_symbol == ')') {

                add_closing_parenthesis(f);
                console.log(`adding closing parenthesis in line ${f.line} of ${f.name.split(__dirname)[1]}`);
                return run()
            }
        }



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
