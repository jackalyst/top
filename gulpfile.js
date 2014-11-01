var gulp = require('gulp');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var minify = require('gulp-minify-css');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');

var paths = {
	scss:['src/css/*.scss', 'bower_components/font-awesome/scss/*.scss'],
	js:  ['src/js/*.js']
};

// SASS, WHY??!
gulp.src('bower_components/normalize.css/normalize.css')
	.pipe(rename('_normalize.scss'))
	.pipe(gulp.dest('bower_components/normalize.css/'));

gulp.src('bower_components/jquery/dist/jquery*.js')
	.pipe(gulp.dest('dist/js/'));

gulp.src('bower_components/font-awesome/fonts/*')
	.pipe(gulp.dest('dist/fonts/'));

gulp.task('scss', function() {
	return gulp.src(paths.scss)
		.pipe(sourcemaps.init())
		.pipe(sass())
		.pipe(sourcemaps.write())
		.pipe(gulp.dest('dist/css/'))
		.pipe(minify())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('dist/css/'));
});

gulp.task('js', function() {
	return gulp.src(paths.js)
		.pipe(sourcemaps.init())
		.pipe(sourcemaps.write())
		.pipe(gulp.dest('dist/js/'))
		.pipe(uglify())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('dist/js/'));
});


gulp.task('watch', function() {
  gulp.watch(paths.scss, ['scss']);
  gulp.watch(paths.js, ['js']);
});

gulp.task('default', ['watch','scss','js']);