'use strict';

var addsrc = require('gulp-add-src');
var concat = require('gulp-concat');
var debug = require('gulp-debug');
var del = require('del');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var minifyCSS = require('gulp-minify-css');
var minimist = require('minimist');
var ngHtml2Js = require('gulp-ng-html2js');
var path = require('path');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var streamqueue = require('streamqueue');
var targetHTML = require('gulp-targethtml');
var uglify = require('gulp-uglify');
var usemin = require('gulp-usemin');


var argv = minimist(process.argv);

var apps = [
  'badgetracker',
  'classmentors',
  'singpath'
];

var config = {
  src: './src',
  watch: './src/**/*',
  apps: apps,
  pages: './src/*.html',
  appFiles: apps.map(function(app) {
    return './src/' + app + '/**/*';
  }),
  vendorFiles: './src/vendor/**/*',
  assetsFiles: './src/assets/**/*',
  sharedFiles: './src/shared/**/*',
  build: {
    concat: './build',
    debug: './build-debug',
    dev: './build-dev',
    dist: './dist',
    e2e: './build-e2e',
  },
  bootstrap: {
    assets: [
      'src/vendor/bootstrap/dist/fonts/*',
    ],
    base: 'src/vendor/bootstrap/dist'
  },
  // only used for build:concat and dist
  dest: argv.dest ? path.resolve(argv.dest) : null,
  noduleNames: {
    singpath: 'spf',
    classmentors: 'clm',
    badgetracker: 'oep'
  }
};

/**
 * Simply copy build and process index.html for targets
 *
 */
function copyBuid(target, dest) {
  dest = dest || config.build[target];

  return gulp.src([config.pages], {
      base: config.src
    })
    .pipe(targetHTML(target))
    .pipe(addsrc([config.vendorFiles, config.assetsFiles, config.sharedFiles].concat(config.appFiles), {
      base: config.src
    }))
    .pipe(gulp.dest(dest));
}



/**
 * Stream that build and dist tasks will share
 *
 */
function concatBuild(appName) {
  var appJsFilter = gulpFilter(['app.js']);
  var scriptsFilter = gulpFilter(['*.js', '*.css']);

  // Concat scrips (css and js).
  var concatScripts = gulp.src([config.src + '/' + appName + '.html'], {
      base: config.src
    })
    .pipe(rename('index.html'))
    .pipe(targetHTML('live'))
    .pipe(usemin());

  // Compile partials html templates to js
  // and add it to app.js
  var concatScriptsWithTemplate = streamqueue({
        objectMode: true
      },
      concatScripts.pipe(appJsFilter),
      gulp.src([
        config.src + '/' + appName + '/**/*.html',
        config.src + '/shared/**/*.html',
        config.src + '/' + appName + '/**/*.svg',
        config.src + '/shared/**/*.svg'
      ], {
        base: config.src
      })
      .pipe(ngHtml2Js({
        moduleName: config.noduleNames[appName]
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
 * Stream shared by the 3 app concat build tasks.
 *
 */
function buildApp(appName, dest) {
  var scriptsFilterRev = gulpFilter(['*', '!index.html']);

  dest = dest || config.build.concat;

  // Append a hash to all assets file
  return concatBuild(appName)
    .pipe(scriptsFilterRev)
    .pipe(rev())
    .pipe(scriptsFilterRev.restore())
    .pipe(revReplace())
    .pipe(gulp.dest(dest + '/' + appName));
}

/**
 * Stream shared by the 3 app dist tasks
 *
 */
function buildAppDist(appName, dest) {
  var jsFilter = gulpFilter(['*.js']);
  var cssFilter = gulpFilter(['*.css']);
  var scriptsFilterRev = gulpFilter(['*', '!index.html']);

  dest = dest || config.build.dist;

  // Append a hash to all assets file
  return concatBuild(appName)
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

  .pipe(gulp.dest(dest + '/' + appName));
}

/**
 * Delete all build reportories (build/, dist/, debug/ and e2e/)
 *
 */
gulp.task('clean', function(done) {
  var folders = Object.keys(config.build).map(function(k) {
    return config.build[k];
  });

  if (config.dest) {
    folders.push(config.dest);
  }

  del(folders, {
    force: true
  }, done);

});


/**
 * Copy src/ to build-dev/ and tweak mocking.
 *
 */
gulp.task('build:dev', ['clean'], function() {
  return copyBuid('dev', config.build.dev);
});


/**
 * Copy src/ to debug/ and remove any mocking.
 *
 */
gulp.task('build:debug', ['clean'], function() {
  return copyBuid('live', config.build.debug);
});


/**
 * Copy src/ to e2e/ and remove the mocked spf module. But unlike debug,
 * it keeps the loading angular-mocks and and spf ficture data. It's up
 * to each e2e scenario to mock th http response.
 *
 */
gulp.task('build:e2e', ['clean'], function() {
  return copyBuid('e2e');
});


/**
 * For each app, add a build:concat-<app name> task:
 *
 * - build:concat-badgetracker
 * - build:concat-classmentors
 * - build:concat-singpath
 *
 */
config.apps.map(function(appName) {
  gulp.task('build:concat-' + appName, ['clean'], function() {
    return buildApp(appName, config.dest);
  });
});

/**
 * Build the apps into build/<app name> by removing any mocking and by concataning
 * assets for each app.
 */
gulp.task('build:concat', ['clean'].concat(config.apps.map(function(appName) {
  return 'build:concat-' + appName;
})));

gulp.task('build', ['build:dev', 'build:debug', 'build:e2e', 'build:concat']);

gulp.task('watch', ['build:dev', 'build:debug', 'build:e2e', 'build:concat'], function() {
  return gulp.watch(
    'src/**/*', ['build:dev', 'build:debug', 'build:e2e', 'build:concat']
  );
});

gulp.task('watch:dev', ['build:dev'], function() {
  return gulp.watch(
    'src/**/*', ['build:dev']
  );
});

gulp.task('watch:debug', ['build:debug', ], function() {
  return gulp.watch(
    'src/**/*', ['build:debug', ]
  );
});

gulp.task('watch:e2e', ['build:e2e'], function() {
  return gulp.watch(
    'src/**/*', ['build:e2e']
  );
});

gulp.task('watch:concat', ['build:concat'], function() {
  return gulp.watch(
    'src/**/*', ['build:concat']
  );
});


/**
 * For each app, add a dist:<app name> task:
 *
 * - dist:badgetracker
 * - dist:classmentors
 * - dist:singpath
 *
 */
config.apps.map(function(appName) {
  gulp.task('dist:' + appName, ['clean'], function() {
    return buildAppDist(appName, config.dest);
  });
});

/**
 * Like build but minify css and js files too.
 *
 */
gulp.task('dist', ['clean'].concat(config.apps.map(function(appName) {
  return 'dist:' + appName;
})));

gulp.task('default', ['build:concat']);
