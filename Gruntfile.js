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
    
    grunt.registerTask('default', ['jshint', 'sass', 'watch']);
};
