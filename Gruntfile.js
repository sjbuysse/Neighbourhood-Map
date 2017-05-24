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
        uglify: {
            options: {
                // don't change variable names
                //mangle: false
            },
            target: {
                files: [{
                    expand: true,    // allow dynamic building
                    cwd: config.jsSrcDir,
                    src: ['*.js', '!*.min.js'],  // source files mask
                    dest: config.jsSrcDir,    // destination folder
                    ext: '.min.js'   // replace .js to .min.js
                }]
            }
        },
        concat: {
            helperJS: {
                src: [config.jsSrcDir + '*.min.js', '!' + config.jsSrcDir + 'main.min.js'],
                dest: config.jsDistDir + 'built.js'
            }
        },
        copy: {
            vendorJs: {
                files:[{
                    expand: true, 
                    cwd: config.jsSrcDir + 'vendor/', 
                    src: ['*.js'], 
                    dest: config.jsDistDir + 'vendor/'
                }]
            },
            mainJs: {
                src: config.jsSrcDir + 'main.min.js', 
                dest: config.jsDistDir + 'main.min.js'
            }
        },
        jshint: {
            beforeUglify: ['Gruntfile.js', config.jsSrcDir + '*.js', '!' + config.jsSrcDir + '*.min.js']
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
                    minify: true,
                    base: 'dist/',
                    css: 'css/*.css',
                },
                // The source file
                src: 'src/index.html', 
                dest: 'dist/index.html'
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
    
    grunt.registerTask('default', ['jshint', 'uglify', 'concat','copy', 'sass', 'postcss', 'critical', 'watch']);
};
