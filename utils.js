const { generate } = require("@babel/generator");
const types = require("@babel/types");

const { default: traverse, NodePath }= require("@babel/traverse");

// Polyfill
const oReplaceWith = NodePath.prototype.replaceWith;
NodePath.prototype.replaceWith = function(){
    this.replaced = true;
    return oReplaceWith.apply(this, arguments);
}

const JSONParse = p => (Function(`return ${p}`))()

const isValidIdentifier = str => /^[\p{ID_Start}$_][\p{ID_Continue}$_]*$/u.test(str);

let n = {
  V: '[A-Za-z_$][\\w$]*', // var
  S: '[\\w$]*', // string
  W: '[-\\w$]*', // string advanced
  X: '[^}]*', // "match till the next }"
  Y: '[^\\/]+', // "match till next /"
  Z: '[^"]*', // "" string advanced
  N: '[0-9]+', // number
  P: '\\s*' // whitespace
}
//\\(${n.V}(?:,${n.V})*\\) arguments (e,e,s,f,a,x,fg)

const RegexStorage = {
    //function I(G,h,O){return O=W(),I=function(E,c,Q){return E=E-113,Q=O[E],Q},I(G,h)}
    GetStringAtIndex: new RegExp(`function ${n.V}\\(${n.V},${n.V},${n.V}\\)\\{return ${n.V}=${n.V}\\(\\),${n.V}=function\\(${n.V},${n.V},${n.V}\\)\\{return ${n.V}=${n.V}-(${n.N}),${n.V}=${n.V}\\[${n.V}\\],${n.V}\\},${n.V}\\(${n.V},${n.V}\\)\\}`, "i"),
    //}})(stringTable, 578281)
    ManipulationFuncEnding: new RegExp(`\\}\\}\\${n.V},(${n.N})\\)`, "i"),
    //function(l,Wj){return null==l?'':O.g(l,6,function(L,W2){return"MQHmW+EXl4yeLIbUigx$wkN9RVPqJr6KYs5v-aOoFf213BCGthD0cZjATuzdn7pS8".charAt(L);});}
    EncodeParams: RegExp(`function\\(${n.V}(?:,${n.V})*\\)\\{return (?:null\s*==\s*${n.V}|${n.V}\s*==\s*null)\\?'':${n.V}\\.${n.V}\\(${n.V},(${n.N}),function\\(${n.V}(?:,${n.V})*\\)\\{return"(${n.Z})"\\.charAt\\(${n.V}\\);\\}\\);\\}`, "i"),
    //y.open("POST","/cdn-cgi/challenge-platform/h/"+c._cf_chl_opt.xkKZ4+"/jsd/oneshot/5eaf848a0845/0.47729002776405693:1765333817:YMWlK4Yk_CgffOni7N8hCRwkv9I1zH8iMjaYrtQSTXs/"+O.r)
    OneshotURL: new RegExp(`${n.V}\\.open\\("POST","\\/cdn-cgi\\/challenge-platform\\/h\\/"\\+${n.V}\\.${n.V}\\.(${n.V})\\+"\\/jsd\\/oneshot\\/(${n.Y})\\/(${n.Y})\\/"\\+${n.V}\\.(${n.V})\\)`, "i"),
    //window._cf_chl_opt={xkKZ4:'g'};
    CF_CHL_Options: new RegExp(`window\\._cf_chl_opt=(\\{${n.X}\\});`, "i"),
    //window.__CF$cv$params={r:'9abf3417685b5332',t:'MTc2NTM5NTUxNg=='}
    CF_CV_Params: new RegExp(`window\\.__CF\\$cv\\$params=(\\{${n.X}\\})`, "i"),
    //function B(Wy,W8,G){return G=c.__CF$cv$params,Math.floor(+atob(G.t));}
    CF_CV_Time: new RegExp(`function ${n.V}\\(${n.V},${n.V},${n.V}\\)\\{return ${n.V}=${n.V}\\.${n.V},Math\\.floor\\(\\+atob\\(${n.V}\\.(${n.V})\\)\\);\\}`, "i"),
};

let isStringFunction = (p) => {
    //function x(p){p="".split(",");x=function(){return p};return x();}
    let body = p?.node?.body?.body?.[0]?.argument?.expressions;

    return body?.length === 3 &&
        body?.[0]?.left?.type === "Identifier" &&
        body?.[0]?.right?.callee?.object?.type === "StringLiteral" &&
        body?.[0]?.right?.callee?.property?.name === "split" &&
        body?.[0]?.right?.arguments?.[0]?.value === "," && 
        body?.[1]?.left?.type === "Identifier" &&
        body?.[1]?.right?.type === "FunctionExpression" &&
        body?.[1]?.right?.body?.body?.[0]?.argument?.type === "Identifier" &&
        body?.[2]?.type === "CallExpression" &&
        body?.[2]?.callee?.type === "Identifier";
}

let isStringManipulationFunction = (p) => {
    //(function (y, Q, xd, x0, I, V) {})(x, 663563);
    return p?.type === "CallExpression" && 
        p?.node?.arguments?.[0]?.type === "Identifier" &&
        p?.node?.arguments?.[1]?.type === "NumericLiteral" &&
        p?.node?.callee?.type === "FunctionExpression"
}

function generateLookupIndex(lookup) {
    let stringTableFunc_String = `function stringTable(arg) {
    arg = "${lookup.mainString}".split(",");
    stringTable = function () {
        return arg;
    };
    return stringTable();
    }`;
    let lookupFunc_String = `function lookupIndex(num, arg, str) {
        str = stringTable();
        lookupIndex = function (numb, arg, stri) {
        numb = numb - ${lookup.getAtIndexNumber};
        stri = str[numb];
        return stri;
        };
    return lookupIndex(num, arg);
    }`;

    lookup.manipulationFunction.get("arguments.0").replaceWith(types.identifier("stringTable"));

    const lookupFunctionName = lookup.getAtIndexFunction.node.id.name;
    const lookupFunctionReferences = lookup.getAtIndexFunction.scope.getBinding(lookupFunctionName).referencePaths;
    const ManipulationReference = lookupFunctionReferences.find(r=>r.findParent(p => p.node === lookup.manipulationFunction.node));
    ManipulationReference.replaceWith(types.identifier("lookupIndex"));

    let manipulateFunction_String = generate(lookup.manipulationFunction.node).code;

    let fullFunction = Function(`
${stringTableFunc_String}\n
${lookupFunc_String}\n
!${manipulateFunction_String}\n
return lookupIndex
`);
    return fullFunction()
}

function deobfuscateCall(path, lookupIndex){
    let argument = path.get("arguments.0");
    switch(argument.type){
        case "NumericLiteral": {
            let deobfuscatedValue = lookupIndex(argument.node.extra.rawValue);
            argument.parentPath.replaceWith(types.stringLiteral(deobfuscatedValue));
            break;
        }
        case "MemberExpression": {
            let objectName = argument.node.object.name;
            let propertyName = argument.node.property.name;
            let binding = argument.scope.getBinding(objectName);
            let constantViolation = binding.constantViolations[binding.constantViolations.length - 1];
            let objectParsed = JSONParse(constantViolation.get("right").toString());
            let deobfuscatedValue = lookupIndex(objectParsed[propertyName]);
            argument.parentPath.replaceWith(types.stringLiteral(deobfuscatedValue));

            let allSet = binding.referencePaths.every(p=>p.parentPath.parentPath.replaced);
            if(allSet) constantViolation.remove();
            break;
        }
        default:{
            console.error(`Not implimented for ${argument.type}`)
            break;
        }
    }

}

const deadCode = {};

function deobfuscateAssignment(path, lookupIndex){
    let assignmentName = path.node.left.name;
    deadCode[`${assignmentName}_${path.node.start}_${path.node.end}`] ??= path;
    let assignmentRefs = path.scope.getBinding(assignmentName).referencePaths.flatMap(p => p.parentPath);;
    let referencesCall = assignmentRefs.filter(v=>v.isCallExpression());
    let referencesAssigment = assignmentRefs.filter(v=>v.isAssignmentExpression());

    let referencesSequence = assignmentRefs.filter(v=>v.isSequenceExpression());
    referencesSequence.forEach(p => deobfuscateAssignment(p.parentPath, lookupIndex));

    referencesCall.forEach(p => deobfuscateCall(p, lookupIndex));
    referencesAssigment.forEach(p => deobfuscateAssignment(p, lookupIndex));
}

function cleanupDeadcode(lookup){
  for (let name in deadCode) {
      const path = deadCode[name];
      if(!path.removed){
          path.remove();
      }
  }
  lookup.mainStringFunction.remove();
  lookup.manipulationFunction.remove();
  lookup.getAtIndexFunction.remove();
}

function replaceComputedProperties(ast){
  traverse(ast,{
    MemberExpression(path){
        !function replaceStringProperty(path){
            if(path.node.computed && types.isStringLiteral(path.node.property)){
                let property = path.get("property");
                let object = path.get("object")
                let string = property.node?.value || property.node?.extra?.rawValue;
                if(isValidIdentifier(string)){
                    property.replaceWith(types.identifier(string));
                    delete path.node.computed;
                }
                if(object.isMemberExpression()){
                    replaceStringProperty(object);
                }
            }
        }(path);
    }
});
}

//https://blog.noah.ovh/cloudflare-js-challenge-1/
//https://gist.github.com/noahcoolboy/70d6084779133cd733849e398ebbe80c?ref=blog.noah.ovh#file-compression-js
function compressPayload(str, n, keyFuncString) {
    let keyFunc = (s) => keyFuncString.charAt(s);
    if (null == str)
        return '';

    let aK, word, ax;
    let charN = {}
    let encounteredDic = {}
    let prevWord = ''
    let aB = 2;
    let aC = 3;
    let aD = 2;
    let aE = [];
    let aF = 0;
    let aG = 0;
    let i = 0

    for (i = 0; i < str.length; i++) {
        let char = str.charAt(i);
        if (!Object.prototype.hasOwnProperty.call(charN, char)) {
            charN[char] = aC++;
            encounteredDic[char] = true;
        }
        word = prevWord + char;

        if (Object.prototype.hasOwnProperty.call(charN, word)) {
            prevWord = word;
        } else {
            if (Object.prototype.hasOwnProperty.call(encounteredDic, prevWord)) {
                if (prevWord.charCodeAt(0) < 256) {
                    for (ax = 0; ax < aD; ax++) {
                        aF <<= 1;
                        if (aG == n - 1) {
                            aG = 0;
                            aE.push(keyFunc(aF));
                            aF = 0;
                        } else {
                            aG++;
                        }
                    }

                    aK = prevWord.charCodeAt(0);
                    for (ax = 0; ax < 8; ax++) {
                        aF = aF << 1 | aK & 1;
                        if (aG == n - 1) {
                            aG = 0;
                            aE.push(keyFunc(aF));
                            aF = 0;
                        } else {
                            aG++;
                        }
                        aK >>= 1;
                    }
                } else {
                    aK = 1;
                    for (ax = 0; ax < aD; ax++) {
                        aF = aF << 1 | aK;
                        aG == n - 1 ? (() => {
                            aG = 0;
                            aE.push(keyFunc(aF));
                            return aF = 0;
                        })() : aG++;
                        aK = 0;
                    }

                    aK = prevWord.charCodeAt(0);
                    for (ax = 0; 16 > ax; ax++) {
                        aF = aF << 1 | aK & 1;
                        if (aG == n - 1) {
                            aG = 0;
                            aE.push(keyFunc(aF));
                            aF = 0;
                        } else {
                            aG++;
                        }
                        aK >>= 1;
                    }
                }

                aB--
                if (0 == aB) {
                    aB = Math.pow(2, aD);
                    aD++;
                }
                delete encounteredDic[prevWord];
            } else {
                aK = charN[prevWord];
                for (ax = 0; ax < aD; ax++) {
                    aF = aF << 1 | aK & 1;
                    if (aG == n - 1) {
                        aG = 0;
                        aE.push(keyFunc(aF));
                        aF = 0;
                    } else {
                        aG++;
                    }
                    aK >>= 1;
                }
            }
            aB--;
            if(0 == aB) {
                aB = Math.pow(2, aD);
                aD++;
            }
            charN[word] = aC++;
            prevWord = String(char);
        }
    }

    if ('' !== prevWord) {
        if (Object.prototype.hasOwnProperty.call(encounteredDic, prevWord)) {
            if (256 > prevWord.charCodeAt(0)) {
                for (ax = 0; ax < aD; ax++) {
                    aF <<= 1;
                    if (aG == n - 1) {
                        aG = 0;
                        aE.push(keyFunc(aF));
                        aF = 0;
                    } else {
                        aG++;
                    }
                }

                aK = prevWord.charCodeAt(0);
                for (ax = 0; 8 > ax; ax++) {
                    aF = aF << 1 | aK & 1;
                    aG == n - 1 ? (() => {
                        aG = 0;
                        aE.push(keyFunc(aF));
                        aF = 0;
                    })() : aG++;
                    aK >>= 1;
                }
            } else {
                aK = 1;
                for (ax = 0; ax < aD; ax++) {
                    aF = aF << 1 | aK;
                    if(aG == n - 1) {
                        aG = 0;
                        aE.push(keyFunc(aF));
                        aF = 0;
                    } else {
                        aG++;
                    }
                    aK = 0;
                }

                aK = prevWord.charCodeAt(0);
                for (ax = 0; ax < 16; ax++) {
                    aF = aF << 1 | aK & 1;
                    if(aG == n - 1) {
                        aG = 0;
                        aE.push(keyFunc(aF));
                        aF = 0;
                    } else {
                        aG++;
                    }
                    aK >>= 1;
                }
            }
            aB--;
            if(0 == aB) {
                aB = Math.pow(2, aD);
                aD++;
            }
            delete encounteredDic[prevWord];
        } else {
            aK = charN[prevWord];
            for (ax = 0; ax < aD; ax++) {
                aF = aF << 1 | aK & 1;
                if(aG == n - 1) {
                    aG = 0;
                    aE.push(keyFunc(aF));
                    aF = 0;
                } else {
                    aG++;
                }
                aK >>= 1;
            }
        }
        aB--;
        if(0 == aB) {
            aD++
        }
    }

    aK = 2;
    for (ax = 0; ax < aD; ax++) {
        aF = aF << 1 | aK & 1;
        if(aG == n - 1) {
            aG = 0;
            aE.push(keyFunc(aF));
            aF = 0;
        } else {
            aG++;
        }
        aK >>= 1;
    }

    while(true) {
        aF <<= 1;
        if (aG == n - 1) {
            aE.push(keyFunc(aF));
            break;
        }
        aG++;
    }
    
    return aE.join('');
}


module.exports = {
    isStringFunction,
    isStringManipulationFunction,
    RegexStorage,
    generateLookupIndex,
    compressPayload,
    deobfuscateCall,
    deobfuscateAssignment,
    JSONParse,
    cleanupDeadcode,
    replaceComputedProperties,
    isValidIdentifier
}