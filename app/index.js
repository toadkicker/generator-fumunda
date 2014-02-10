'use strict';
var util = require('util');
var path = require('path');
var yeoman = require('yeoman-generator');
var chalk = require('chalk');

/*
 * Fumunda Generator - The app that gets build fumunda
 * Quickly wire an entire angularjs app by consuming a WADL
 * Built on top of generate-angular
 *
 */
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
            message: 'What is your app called:'
            default: 'fumunda'
        }, {
            url: 'url',
            message: 'What is the WADL url?',
            default: 'http://localhost:8080/application.wadl'
        }];

        this.prompt(prompts, function(props) {
            this.fumundaName = props.fumundaName;
            this.fumundaUrl = props.fumundaUrl;
            done();
        }.bind(this));
    },

    //fetch the wadl
    getWadl: function() {

        var req = http.get(this.fumundaUrl, function(res) {
            // save the data
            var xml = '';
            res.on('data', function(chunk) {
                xml += chunk;
            });

            res.on('end', function() {
                return xml;
                next();
            });
        });

        req.on('error', function(err) {
            console.log(err)
        });
    },

    callGenerator: function(name, opts) {
        //
    },

    wadl: function() {
        //walk the WADL, calling the appropriate generator with the values from the response
        var xmlDoc = this.getWadl();
        for (tag in xmlDoc) {
          if (xmlDoc.hasOwnProperty("resource")) {
            console.info(tag + 'found');
          }
        }
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
