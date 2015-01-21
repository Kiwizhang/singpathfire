var addsrc = require('gulp-add-src');
var concat = require('gulp-concat');
var del = require('del');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var minifyCSS = require('gulp-minify-css');
var ngHtml2Js = require('gulp-ng-html2js');
var replace = require('gulp-replace');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var streamqueue = require('streamqueue');
var targetHTML = require('gulp-targetHTML');
var uglify = require('gulp-uglify');
var usemin = require('gulp-usemin');

var config = {
  src: './src',
  watch: './gitxsrc/**/*',
  index: './src/index.html',
  appFiles: './src/app/**/*',
  vendorFiles: './src/vendor/**/*',
  partials: './src/app/components/**/*.html',
  build: {
    debug: './build-debug',
    e2e: './e2e',
    concat: './build',
    dist: './dist',
  },
  bootstrap: {
    assets: [
      'src/vendor/bootstrap/dist/fonts/*',
    ],
    base: 'src/vendor/bootstrap/dist'
  }
};


/**
 * Stream that build and dist will share
 *
 */
function concatBuild(target) {
  'use strict';

  var appJsFilter = gulpFilter(['app.js']);
  var scriptsFilter = gulpFilter(['*', '!index.html']);

  // Concat scrips (css and js).
  var concatScripts = gulp.src([config.index], {
      base: config.src
    })
    .pipe(targetHTML(target))
    .pipe(usemin());

  // Compile partials html templates to js
  // and add it to app.js
  var concatScriptsWithTemplate = streamqueue({
        objectMode: true
      },
      concatScripts
      .pipe(appJsFilter),
      gulp.src([config.partials], {
        base: config.src
      }).pipe(ngHtml2Js({
        moduleName: 'spf'
      }))
    )
    .pipe(concat('app.js'))
    .pipe(appJsFilter.restore());

  // Get bootstraps' fonts and the their path in the css and js files
  return concatScriptsWithTemplate
    .pipe(addsrc(config.bootstrap.assets, {
      base: config.bootstrap.base
    }))
    .pipe(scriptsFilter)
    .pipe(replace(/\.\.\/fonts\//g, './fonts/'))
    .pipe(scriptsFilter.restore());
}

/**
 * Delete all build reportories (build/, dist/, debug/ and e2e/)
 *
 */
gulp.task('clean', function(done) {
  'use strict';

  del(Object.keys(config.build).map(function(k) {
    return config.build[k];
  }), done);

});

/**
 * Copy src/ to debug/ and remove any http mocking.
 *
 */
gulp.task('debug', ['clean'], function() {
  'use strict';

  return gulp.src([config.index], {
      base: config.src
    })
    .pipe(targetHTML('debug'))
    .pipe(addsrc([config.appFiles, config.vendorFiles], {
      base: config.src
    }))
    .pipe(gulp.dest(config.build.debug));
});

/**
 * Copy src/ to e2e/ and remove the mocked spf module. But unlike debug,
 * it keeps the loading angular-mocks and and spf ficture data. It's up
 * to each e2e scenario to mock th http response.
 *
 */
gulp.task('e2e', ['clean'], function() {
  'use strict';

  return gulp.src([config.index], {
      base: config.src
    })
    .pipe(targetHTML('e2e'))
    .pipe(addsrc([config.appFiles, config.vendorFiles], {
      base: config.src
    }))
    .pipe(gulp.dest(config.build.e2e));
});

/**
 * Build the app into build/ by removing any mocking and by concataning
 * assets.
 */
gulp.task('build', ['clean'], function() {
  'use strict';

  var scriptsFilterRev = gulpFilter(['*', '!index.html']);

  // Append a hash to all assets file
  return concatBuild('build')
    .pipe(scriptsFilterRev)
    .pipe(rev())
    .pipe(scriptsFilterRev.restore())
    .pipe(revReplace())
    .pipe(gulp.dest(config.build.concat));

});

/**
 * Like build but minify css and js files too.
 *
 */
gulp.task('dist', ['clean'], function() {
  'use strict';
  var jsFilter = gulpFilter(['*.js']);
  var cssFilter = gulpFilter(['*.css']);
  var scriptsFilterRev = gulpFilter(['*', '!index.html']);

  // Append a hash to all assets file
  return concatBuild('dist')
    .pipe(jsFilter)
      .pipe(uglify())
      .pipe(jsFilter.restore())

    .pipe(cssFilter)
      .pipe(minifyCSS())
      .pipe(cssFilter.restore())

    .pipe(scriptsFilterRev)
      .pipe(rev())
      .pipe(scriptsFilterRev.restore())
      .pipe(revReplace())

    .pipe(gulp.dest(config.build.dist));

});


gulp.task('watch', ['debug', 'e2e', 'build'], function() {
  'use strict';
  return gulp.watch(
    'src/**/*', ['debug', 'e2e', 'build']
  );
});


gulp.task('default', ['debug', 'e2e', 'build']);
