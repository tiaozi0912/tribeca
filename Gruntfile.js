'use strict';

module.exports = grunt => {
  const commonFiles = 'src/common/*.ts';
  const serviceFiles = [ 'src/service/**/*.ts', commonFiles ];
  const adminFiles = [ 'src/admin/**/*.ts', commonFiles ];
  const html = 'src/static/**';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    watch: {
      service: {
        files: serviceFiles,
        tasks: [ 'ts:service' ],
      },

      client: {
        files: adminFiles,
        tasks: [ 'ts:admin', 'copy', 'browserify' ],
      },

      static: {
        files: html,
        tasks: [ 'copy', 'browserify' ],
      },
    },

    ts: {
      options: {
        sourceMap: true,
        comments: false, // same as !removeComments. [true | false (default)]
        declaration: false, // generate a declaration .d.ts file for every output js file. [true | false (default)]
        fast: 'always',
      },

      service: {
        src: serviceFiles,
        outDir: 'tribeca',
        options: {
          target: 'es6',
          module: 'commonjs',
        },
      },

      admin: {
        src: adminFiles,
        outDir: 'tribeca/service/admin/js',
        options: {
          target: 'es6',
          module: 'commonjs',
        },
      },
    },

    copy: {
      main: {
        expand: true,
        cwd: 'src/static',
        src: '**',
        dest: 'tribeca/service/admin',
      },
    },

    browserify: {
      bundle: {
        src: [ 'src/service/admin/js/admin/client.js' ],
        dest: 'src/service/admin/js/admin/bundle.min.js',
      },
      // dist: {
      //   files: {
      //     'src/service/admin/js/admin/bundle.min.js': [ 'src/service/admin/js/admin/client.js' ],
      //   },
      // },
    },
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-browserify');

  const compile = [ 'ts', 'copy', 'browserify' ];
  grunt.registerTask('browserify', [ 'browserify' ]);
  grunt.registerTask('compile', compile);
  grunt.registerTask('default', compile.concat([ 'watch' ]));
};
