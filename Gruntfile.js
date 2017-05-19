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
                    require('autoprefixer')() // add vendor prefixes
                ]
            },
            dist: {
                src: config.cssDir + '*.css'
            }
        },
        critical: {
            target: {
                options: {
                    minify: 'true',
                    base: './',
                    css: 'css/*.css',
                },
                // The source file
                src: 'index.html', 
                dest: 'index-critical.html'
            }
        },
        watch: {
            scss: {
                options: {
                    cwd: {
                        files: config.scssDir
                    }
                },
                files: '**/*.scss',
                tasks: ['sass']
            },
            postcss: {
                options: {
                    cwd: {
                        files: config.cssDir
                    }
                },
                files: '**/*.css',
                tasks: ['postcss']
            }
        } 
    });
    
    grunt.registerTask('default', ['jshint', 'sass', 'postcss', 'critical', 'watch']);
};
