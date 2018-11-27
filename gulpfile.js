'use strict';

const gulp = require('gulp');
const browserify = require('gulp-browserify');
const rename = require('gulp-rename');
// const uglify = require('gulp-uglify');
const process = require('process');

const env = process.env.NODE_ENV;

gulp.task('browserify', () => {
  gulp.src('src/service/admin/js/admin/client.js')
    .pipe(browserify({
      insertGlobals: true,
      debug: env !== 'production',
    }))
    .pipe(rename('bundle.min.js'))
    .pipe(gulp.dest('src/service/admin/js/admin'));
});
