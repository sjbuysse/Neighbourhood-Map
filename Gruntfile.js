module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    var config = grunt.file.readYAML('Gruntconfig.yml');

    grunt.initConfig({
        sass: {
            dist :{
                files: [{
                    expand: true,
                    cwd: config.scssDir,
                    src: ['**/*.scss'],
                    dest: config.cssDir,
                    ext: '.css'
                }]
            }
        },
        jshint: {
            all: ['Gruntfile.js', config.jsDir + '*.js']
        },
        postcss: {
            options: {
                map: true,
                processors: [
                    require('pixrem')(), // add fallback for rem units
                    require('autoprefixer')(), // add vendor prefixes
                    require('cssnano')() // minify the result
                ]
            },
            dist: {
                src: config.cssDir + '*.css'
            }
        },
        watch: {
            css: {
                options: {
                    cwd: {
                        files: config.scssDir
                    }
                },
                files: '**/*.scss',
                tasks: ['sass']
            }
        } 
    });
    
    grunt.registerTask('default', ['jshint', 'sass', 'postcss', 'watch']);
};
