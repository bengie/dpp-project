'use strict';

/*
 * de Persgroep Frontend gulfile
 *
 * Commands:
 * gulp default
 * "copy" images
 * "copy" fonts
 * js: eslint
 * css: scss-lint
 * WATCH FILES ABOVE
 * gulp deploy
 * "copy" images
 * "copy" fonts
 * js: eslint
 * css: scss-lint
 * Flags:
 * --imagemin=true|false: Null, empty or not true ==> no imagemin (default)
 * --sassoutput=<value>: Null, empty or not one of ['nested', 'expanded', 'compact', 'compressed'] ==> expanded (default)
 * --sourcemaps=true|false: Null, empty or not true ==> sourcemaps (default)
 */

/* do NOT change the order of the pipes as this could cause unwanted effects */
var pkg = require('./package.json'),
	del = require('del'),
	gulp = require('gulp'),
	autoprefixer = require('gulp-autoprefixer'),
	bless = require('gulp-bless'),
	cached = require('gulp-cached'),
	concat = require('gulp-concat'),
	copy = require('gulp-copy'),
	eslint = require('gulp-eslint'),
	notify = require('gulp-notify'),
	plumber = require('gulp-plumber'),
	sass = require('gulp-sass'),
	scssLint = require('gulp-scss-lint'),
	sourcemaps = require('gulp-sourcemaps'),
	uglify = require('gulp-uglify'),
	gUtil = require('gulp-util'),
	fileExists = require('file-exists'),
	rename = require('gulp-rename'),
	gitHookDestinationPath = pkg.git.hooks.precommit.dest.substring(0, pkg.git.hooks.precommit.dest.lastIndexOf('/') + 1),
	gitHookDestinationName = pkg.git.hooks.precommit.dest.substring(pkg.git.hooks.precommit.dest.lastIndexOf('/') + 1);

// helper functions
function onError(err) {
	gUtil.log('\n', gUtil.colors.bold(gUtil.colors.red('Error ocurred: ') + err.message + ' @ ' + err.fileName + ':' + err.lineNumber), '\n');
	gUtil.beep();
	this.emit('end');
}

function getArgument(key) {
	return gUtil.env[key] ? gUtil.env[key] : null;
}

// clean folders
gulp.task('clean', function() {
	pkg.clean.forEach(function(path) {
		return del.sync(path, {
			'force': true
		});
	});
});

//  Images
gulp.task('imgbuild', function() {
	return gulp.src(pkg.img.src)
		.pipe(copy(pkg.img.dest, {
			'prefix': 1
		})) // needs to be copy, not just ".dest" as mac often throws errors when the folder doesn't exist
		.pipe(notify({
			'message': 'IMG build complete',
			'onLast': true // otherwise the notify will be fired for each file in the pipe
		}));
});

// Javascript
gulp.task('eslint', function() {
	return gulp.src(pkg.js.hint.src)
		.pipe(plumber({
			'errorHandler': onError
		}))
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});

gulp.task('js', ['eslint'], function() {
	gulp.start('jsbuild');
});

gulp.task('jsbuild', function() {
	var sourcemapsArg = getArgument('sourcemaps'),
		writeSourcemaps = sourcemapsArg === null || sourcemapsArg === 'true';

	pkg.js.files.forEach(function(o) {
		return gulp.src(o.src)
			.pipe(plumber({
				'errorHandler': onError
			}))
			.pipe(writeSourcemaps ? sourcemaps.init() : gUtil.noop())
			.pipe(concat(o.file))
			.pipe(uglify({
				'compress': {
					'hoist_funs': false // hoist function declarations - otherwise functions are alphabetized, which can cause errors
				}
			}))
			.pipe(writeSourcemaps ? sourcemaps.write('maps') : gUtil.noop())
			.pipe(gulp.dest(o.dest))
			.pipe(notify({
				'message': 'JS: ' + o.file + ' build complete',
				'onLast': true // otherwise the notify will be fired for each file in the pipe
			}));
	});
});

// CSS
gulp.task('scsslint', function() {
	return gulp.src(pkg.sass.hint.src)
		.pipe(cached('scssLint'))
		.pipe(scssLint());
});

gulp.task('sass', ['scsslint'], function() {
	gulp.start('sassbuild');
});

gulp.task('sassbuild', function() {
	var sassoutputArg = getArgument('sassoutput');

	pkg.sass.files.forEach(function(o) {
		return gulp.src(o.src)
			.pipe(plumber({
				'errorHandler': onError
			}))

			// .pipe(plugins.sourcemaps.init()) // can't get them to work in conjunction with bless
			.pipe(sass({
				'outputStyle': sassoutputArg === null || ['nested', 'expanded', 'compact', 'compressed'].indexOf(sassoutputArg) < 0 ? 'expanded' : sassoutputArg
			}))
			.pipe(autoprefixer({
				'browsers': pkg.sass.autoprefixer.browsers
			}))

			// .pipe(plugins.sourcemaps.write('maps')) // can't get them to work in conjunction with bless
			.pipe(bless())
			.pipe(gulp.dest(o.dest))
			.pipe(notify({
				'message': 'SASS: ' + o.file + ' build complete',
				'onLast': true // otherwise the notify will be fired for each file in the pipe
			}));
	});
});

// build all task
gulp.task('build', ['hook', 'clean'], function() {
	// pay attention when upgrading gulp: https://github.com/gulpjs/gulp/issues/505#issuecomment-45379280
	gulp.start('imgbuild');
	gulp.start('jsbuild');
	gulp.start('sassbuild');
});

// default task
gulp.task('default', ['hook', 'clean'], function() {
	// pay attention when upgrading gulp: https://github.com/gulpjs/gulp/issues/505#issuecomment-45379280
	gulp.start('imgbuild');
	gulp.start('js');
	gulp.start('sass');

	// watch
	gulp.watch(pkg.img.watch, ['imgbuild']);
	gulp.watch(pkg.js.watch, ['js']);
	gulp.watch(pkg.sass.watch, ['sass']);
});

// deploy task
gulp.task('deploy', function() {
	// pay attention when upgrading gulp: https://github.com/gulpjs/gulp/issues/505#issuecomment-45379280
	gulp.start('imgbuild');
	gulp.start('jsbuild');
	gulp.start('sassbuild');
});

// pre-commit
// on Mac, make sure the folder exists
gulp.task('hook', function() {
	if (!fileExists(pkg.git.hooks.precommit.dest)) {
		gulp.src(pkg.git.hooks.precommit.src)
			.pipe(rename(gitHookDestinationName))
			.pipe(gulp.dest(gitHookDestinationPath))
			.on('error', function() {
				// Ignore silently
			})
			.pipe(notify({
				'message': 'HOOK: Copied scripts/.pre-commit to .git/hooks/pre-commit',
				'onLast': true // otherwise the notify will be fired for each file in the pipe
			}));
	}
});

