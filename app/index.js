'use strict';
var util = require('util');
var path = require('path');
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
//change to http, if you don't use https
var https = require('https');
var DOMParser = require('xmldom').DOMParser;
var fs = require('fs');

//for file output
var writeToFile = (function(path, content) {
    fs.writeFile(path, content, function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log("The file was saved!");
        }
    });
});

//use https?? and SSL is self-assigned, set to 0 and it will run
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/*
 * Fumunda Generator - The app that gets build fumunda
 * Quickly wire an entire angularjs app by consuming a WADL
 * Built on top of generate-angular
 *
 */
var generateAPIFromWadl = {
    proceedApiGeneration: function(name, url) {
        var apiGen = this;
        var typeContainer = {};
        //walk the WADL, calling the appropriate generator with the values from the response
        apiGen.getXmls(url, function(xmls) {
            var wadlResources = {
                path: '',
                resources: []
            };

            //get the nodes of the WADL-File
            var node = (new DOMParser()).parseFromString(xmls.wadlXml, "text/xml").documentElement;
            var nodes = node.getElementsByTagName("resources");


            //get the nodes of the XSD-xml (for the types)
            var typeNode = (new DOMParser()).parseFromString(xmls.typeXml, "text/xml").documentElement;
            var allTypes = typeNode.getElementsByTagName('xs:complexType');

            if (nodes.length === 1 && nodes[0].tagName === 'resources' && nodes[0].hasAttribute('base')) {

                var fullPath = nodes[0].getAttribute('base');

                var relativePath = fullPath.substring(fullPath.indexOf('/') + 1, fullPath.length);
                relativePath = relativePath.substring(relativePath.indexOf('/') + 1, relativePath.length);
                relativePath = relativePath.substring(relativePath.indexOf('/') + 1, relativePath.length);
                wadlResources.path = relativePath;
                nodes = nodes[0].childNodes;
            }
            else {
                console.log('No resources node found or "base" attribute is missing.');
                return;
            }

            //retreive the structure of the object in JSON
            var getJSONObject = (function(objectName) {
                if (objectName === undefined || objectName === '')
                    return {};
                var type = {};

                objectName = objectName.toLowerCase();

                if (typeContainer[objectName] !== undefined) {
                    return typeContainer[objectName];
                }
                console.log('seek type:', objectName);
                for (var i = 0; i < allTypes.length; i++)
                {
                    if (allTypes[i].getAttribute('name').toLowerCase() === objectName.toLowerCase())
                    {
                        type = allTypes[i];
                        //console.log('assign type:', objectName);
                        break;
                    }
                }
                var properties = {};

                if (type.childNodes === undefined) {
                    return undefined;
                }

                for (var i = 0; i < type.childNodes.length; i++)
                {
                    if (type.childNodes[i].tagName === 'xs:sequence')
                    {
                        properties = type.childNodes[i].childNodes;
                        //console.log('assign prop:', type.childNodes[i].tagName, 'i:', i, 'length', type.childNodes.length);

                    }
                }


                typeContainer[objectName] = {};
                for (var i = 0; i < properties.length; i++)
                {
                    if (properties[i].tagName === 'xs:element') {
                        //console.log('propertie-tag-name: ', properties[i].tagName);
                        var type = properties[i].getAttribute('type').toLowerCase();
                        var name = properties[i].getAttribute('name');
                        switch (type) {
                            case 'xs:string':
                                typeContainer[objectName][name] = '';
                                break;
                            case 'xs:int':
                                typeContainer[objectName][name] = 0;
                                break;
                            case 'xs:boolean':
                                typeContainer[objectName][name] = false;
                                break;
                            default:
                                //console.log('found dependency:', type);
                                typeContainer[objectName][name] = getJSONObject(type);
                                break;
                        }
                    }
                }
                //console.log('ret:', container[objectName]);
                return typeContainer[objectName];
            });

            //creates the structure for use as a API (uses jQuery.ajax )
            var createWadlResource = (function(baseResource, node, baseUri, level) {
                {
                    var path = node.getAttribute('path');
                    var lastIndexOfPoint = path.lastIndexOf('.') + 1;
                    var resource = {
                        elementName: path.substring(lastIndexOfPoint, path.length),
                    };
                    if (level === 0) {
                        baseResource = resource;
                    }
                    var nodeChildNodes = node.childNodes;
                    for (var i = 0; i < nodeChildNodes.length; i++)
                    {
                        switch (nodeChildNodes[i].tagName) {
                            case 'resource':
                                var innerResource = createWadlResource(baseResource, nodeChildNodes[i], baseUri + path + '/', level + 1);

                            case 'param':
                                if (level !== 0) {
                                    resource.params = resource.params === undefined ? [] : resource.params;
                                    resource.params.push({
                                        name: nodeChildNodes[i].getAttribute('name'),
                                        type: nodeChildNodes[i].getAttribute('type'),
                                        style: nodeChildNodes[i].getAttribute('style')
                                    });
                                }
                                break;
                            case 'method':
                                if (nodeChildNodes[i].getAttribute('name') === 'OPTIONS') {
                                    continue;
                                }

                                var addMethodNode = (function(node, addElement) {
                                    var method = {
                                        id: node.getAttribute('id'),
                                        name: node.getAttribute('name'),
                                        request: [],
                                        response: []
                                    };
                                    var nodeChildNodes = node.childNodes;
                                    for (var i = 0; i < nodeChildNodes.length; i++)
                                    {
                                        switch (nodeChildNodes[i].tagName)
                                        {
                                            case 'response':
                                                var responseChilds = nodeChildNodes[i].childNodes;
                                                for (var y = 0; responseChilds.length > y; y++)
                                                {
                                                    if (responseChilds[y].tagName !== 'ns2:representation' &&
                                                            responseChilds[y].tagName !== 'representation') {
                                                        continue;
                                                    }

                                                    var elementName = responseChilds[y].attributes !== null && responseChilds[y].hasAttribute('element') ? responseChilds[y].getAttribute('element') : '';

                                                    method.response.push({
                                                        elementName: elementName,
                                                        element: getJSONObject(elementName),
                                                        mediaType: responseChilds[y].attributes !== null && responseChilds[y].hasAttribute('mediaType') ? responseChilds[y].getAttribute('mediaType') : ''
                                                    });

                                                }
                                                break;
                                            case 'request':
                                                var requestChilds = nodeChildNodes[i].childNodes;
                                                for (var y = 0; requestChilds.length > y; y++)
                                                {
                                                    if (requestChilds[y].tagName !== 'ns2:representation' &&
                                                            requestChilds[y].tagName !== 'representation') {
                                                        continue;
                                                    }
                                                    var elementName = requestChilds[y].attributes !== null && requestChilds[y].hasAttribute('element') ? requestChilds[y].getAttribute('element') : '';

                                                    method.request.push({
                                                        elementName: elementName,
                                                        element: getJSONObject(elementName),
                                                        mediaType: requestChilds[y].attributes !== null && requestChilds[y].hasAttribute('mediaType') ? requestChilds[y].getAttribute('mediaType') : ''
                                                    });

                                                }
                                                break;
                                            default:
                                                break;
                                        }
                                    }

                                    addElement(resource, method, baseUri + path);
                                });

                                addMethodNode(nodeChildNodes[i], function(thisResource, method, path) {
                                    baseResource[method.id] = {};
                                    baseResource[method.id].data = {};
                                    baseResource[method.id].data = method;

                                    var elementelType = getJSONObject(resource.elementName);
                                    if (elementelType !== undefined) {
                                        baseResource.baseType = elementelType;
                                    }

                                    var hasParam = thisResource.params !== undefined && thisResource.params.length > 0;
                                    var countParam = !hasParam ? 0 : thisResource.params.length;
                                    var pathExtension = '';
                                    var pathExtensionParam = '';

                                    switch (countParam)
                                    {
                                        case 0:
                                            break;
                                        case 1:
                                            var paramName = thisResource.params[0].name;
                                            path = path.replace('{' + paramName + '}', '');
                                            pathExtension = paramName;
                                            pathExtensionParam = paramName + ', ';

                                            break;
                                        case 2:
                                            var paramName = thisResource.params[0].name;
                                            var paramName2 = thisResource.params[1].name;
                                            path = path.replace('{' + paramName + '}/{' + paramName2 + '}', '');
                                            // path/
                                            pathExtension = paramName + ' + "/" + ' + paramName2;
                                            pathExtensionParam = paramName + ', ' + paramName2 + ', ';
                                            break;
                                    }
                                    console.log('countParam ', countParam);
                                    console.log('pathExtension ', pathExtension);
                                    console.log('pathExtensionParam ', pathExtensionParam);

                                    var methodToAdd = '';
                                    switch (baseResource[method.id].data.name) {
                                        case 'POST':
                                        case 'PUT':
                                            methodToAdd =
                                                    'x{[xfunction(' + (countParam > 0 ? pathExtensionParam : '') + 'data, successCallback, errorCallback){' +
                                                    'jQuery.ajax( {' +
                                                    'headers: { ' +
                                                    '"Accept": "application/json",' +
                                                    '"Content-Type": "application/json"' +
                                                    '},' +
                                                    'type: "' + baseResource[method.id].data.name + '",' +
                                                    'url: "' + path + (countParam > 0 ? '" + ' + pathExtension : '"') + ',' +
                                                    'data: JSON.stringify(data),' +
                                                    'dataType: "json",' +
                                                    'success: function(data){successCallback(data);},' +
                                                    'error: function(data){errorCallback(data);}' +
                                                    '});}x]}x';
                                            break;
                                        case 'DELETE':
                                        case 'GET':
                                            methodToAdd =
                                                    'x{[xfunction(' + (countParam > 0 ? pathExtensionParam : '') + 'successCallback, errorCallback){' +
                                                    'jQuery.ajax( {' +
                                                    'url: "' + path + (countParam > 0 ? '" + ' + pathExtension : '"') + ',' +
                                                    'dataType: "json",' +
                                                    'type: "' + baseResource[method.id].data.name + '",' +
                                                    'success: function(data){successCallback(data);},' +
                                                    'error: function(data){errorCallback(data);}' +
                                                    '});}x]}x';
                                            break;
                                    }
                                    baseResource[method.id] = methodToAdd;
                                });


                                break;
                            default:
                                //do nothing
                                break;
                        }
                    }
                    return resource;
                }
            });

            //process the nodes and create the API
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].tagName === 'resource') {

                    var resource = createWadlResource({}, nodes[i], wadlResources.path, 0);
                    wadlResources[resource.elementName] = resource;
                }

            }
            
            //write the result to files
            writeToFile('/run/media/lucas/Stuff/Project/Project14/WebApp/public_html/js/api/' + name + '.js',
                    'var dal = ' +
                    util.inspect(wadlResources, false, null)
                    + ';'
                    );
            writeToFile('/run/media/lucas/Stuff/Project/Project14/WebApp/public_html/js/api/' + name + '.json',
                    JSON.stringify(wadlResources, null, 4)
                    );
        });
    },
    getXml: function(url, callBack) {
        var xml = '';
        var req = https.get(url, function(res) {
            // save the data

            res.on('data', function(chunk) {
                xml += chunk;
            });
            res.on('end', function() {
                callBack(xml);
            });
        });
        req.on('error', function(err) {
            console.log(err);
        });
    },
    getXmls: function(url, callBackFunction) {
        var genApp = this;
        var xmls = {
            wadlXml: {},
            typeXml: {}
        };
        genApp.getXml(url, function(wadlXml) {
            genApp.getXml(url + '/xsd0.xsd',//TODO: maybe set to dynamic!
                    function(typeXml) {
                        xmls = {
                            wadlXml: wadlXml,
                            typeXml: typeXml
                        };
                        callBackFunction(xmls);
                    });
        });
    }
};


var FumundaGenerator = yeoman.generators.Base.extend({
    init: function() {
        this.pkg = yeoman.file.readJSON(path.join(__dirname, '../package.json'));
        this.on('end', function() {
            if (!this.options['skip-install']) {
                this.npmInstall();
            }
        });
    },
    askFor: function() {
        var done = this.async();
        // have Yeoman greet the user
        console.log(this.yeoman);
        // replace it with a short and sweet description of your generator
        console.log(chalk.magenta('You\'re using the fantastic Fumunda generator.'));
        var prompts = [{
                name: 'name',
                message: 'What is your app called:',
                default: 'fumunda'
            }, {
                name: 'url',
                url: 'url',
                message: 'What is the WADL url?',
                default: 'http://localhost:8080/application.wadl'
            }];
        this.prompt(prompts, function(props) {
            //start the JS-Api generation
            generateAPIFromWadl.proceedApiGeneration(props.name, props.url);
        });
    },
    callGenerator: function(name, opts) {
        //
    },
    types: function() {

    },
    //output the 
    app: function() {
        this.mkdir('app');
        this.mkdir('app/templates');
        this.copy('_package.json', 'package.json');
        this.copy('_bower.json', 'bower.json');
    },
    projectfiles: function() {
        this.copy('editorconfig', '.editorconfig');
        this.copy('jshintrc', '.jshintrc');
    }
});
module.exports = FumundaGenerator;
