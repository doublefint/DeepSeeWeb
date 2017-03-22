var gulp   = require('gulp'),
    uglify = require('gulp-uglify'),
    useref = require('gulp-useref'),
    jshint = require('gulp-jshint'),
    concat = require('gulp-concat'),
    cssmin = require('gulp-cssmin'),
    sass = require('gulp-sass'),
    templateCache = require('gulp-angular-templatecache'),
    del = require('del'),
    zip = require('gulp-zip'),
    bump = require('gulp-bump'),
    replace = require('gulp-replace'),
    release = require('gulp-github-release'),
    through = require('through2'),
    traceur = require('gulp-traceur-compiler');

    // TODO: add html-min

    //jsdoc = require("gulp-jsdoc");

gulp.task('sass-themes', function () {
    return gulp.src(['./css/sass/themes/*.scss'])
        .pipe(sass({
            sourceComments: 'map',
            sourceMap: 'sass',
            outputStyle: 'nested'
        }).on('error', sass.logError))
        .pipe(gulp.dest('./css/themes/'));
});

// Build sass
gulp.task('sass-dev', ['sass-themes'], function () {
    return gulp.src(['./css/sass/*.scss'])
        .pipe(sass({
            sourceComments: 'map',
            sourceMap: 'sass',
            outputStyle: 'nested'
        }).on('error', sass.logError))
        .pipe(gulp.dest('./css/'));
});

// Sass watcher
gulp.task('sass:watch', ['sass-dev'], function () {
    var sassSrc = ['./css/sass/*.scss', './css/sass/themes/*.scss', './css/sass/base/*.scss'];
    if (!(sassSrc instanceof Array)) { sassSrc += '*.scss'; }
    gulp.watch(sassSrc, ['sass-dev']);
});


// Runing jshint an all source
gulp.task('lint', function() {
    gulp.src(['src/**/*.js', '!src/lib/*', '!src/addons/*'])
        .pipe(jshint( { esversion: 6 } ))
        .pipe(jshint.reporter('default'));
});

// Minify all project js files
gulp.task('minify', function () {
    var assets = useref.assets();
    var p = require('./package.json');
    return gulp.src('index.html')
        .pipe(assets)
        .pipe(replace('"{{package.json.version}}"', '"' + p.version + '"'))
        .pipe(traceur())
        .pipe(uglify())
        .pipe(assets.restore())
        .pipe(useref())
        .pipe(gulp.dest('build'));
});

// Append templates.js to app.js
gulp.task('concat-templates', ['templates', 'minify'], function() {
    return gulp.src(['build/src/app.js', 'build/src/templates.js'])
        .pipe(concat('app.js'))
        .pipe(gulp.dest('build/src'));
});

// Minify css files
gulp.task('cssminify', ['sass-dev'], function () {
    gulp.src(['css/main.css', 'css/new.min.css', 'css/default.css'])
        .pipe(cssmin())
        .pipe(concat('main.css'))
        .pipe(gulp.dest('build/css'));
});

// Copy other files to dist (like fonts, libs, images)
gulp.task('copyfiles', ['sass-dev'], function () {
    gulp.src(['src/addons/*.js'])
        .pipe(gulp.dest('build/addons'));
    gulp.src(['src/lib/*.js'])
        .pipe(gulp.dest('build/src/lib'));
    gulp.src(['css/*.min.css'])
        .pipe(gulp.dest('build/css'));
    gulp.src(['css/mobile.css'])
        .pipe(gulp.dest('build/css'));
    gulp.src(['css/themes/*.css'])
        .pipe(gulp.dest('build/css/themes'));
    gulp.src(['fonts/*'])
        .pipe(gulp.dest('build/fonts'));
    gulp.src(['img/**/*'])
        .pipe(gulp.dest('build/img'));
    gulp.src(['updater.csp'])
        .pipe(gulp.dest('build'));
});

gulp.task('copyfiles-mobile', ['copyfiles'], function () {
    gulp.src(['mobile/**/*'])
        .pipe(gulp.dest('build/'));
});

// Create single tamplates file from *.html views
gulp.task('templates', function() {
    var p = require('./package.json');
    return gulp.src(['src/views/*.html'])
        .pipe(replace('{{package.json.version}}', p.version))
        .pipe(templateCache({root:"src/views/"}))
        .pipe(gulp.dest('build/src'));
});

// Remove temporary files
gulp.task('cleanup', ['concat-templates'], function() {
    del(["build/src/templates.js"]);
    //del(["build/css/**/*"]);
    del(["build/*.zip"]);
    del(["build/res/**/*"]);
});

// Creates zip with builded project
gulp.task('zip', function() {
    var p = require('./package.json');

    return gulp.src('build/**/*')
        .pipe(zip('DSW-' + p.version + '.zip'))
        .pipe(gulp.dest('build'));
});

// Deploys release on github
/*gulp.task('upload', ['zip'], function() {
    var p = require('./package.json');
    return gulp.src('./build/' + 'DSW-' + p.version + '.zip')
    .pipe(release({
        token: '',                     // or you can set an env var called GITHUB_TOKEN instead
        owner: 'gnibeda',
        name: 'DeepSeeWeb v' + p.version,
        repo: 'publish-release',
        tag: 'v'+p.version,
        manifest: p
    }));
});*/

gulp.task('makerelease', ['zip'], function() {
    return gulp.src('./package.json')
        //.pipe(bump())
        .pipe(gulp.dest('./'));
});

var FILE_LIST;
gulp.task('enum-files', function() {
    FILE_LIST = [];
    return gulp.src(['./build/**/*', '!./build/DSW.Installer*.xml'])
        .pipe(through.obj(function (chunk, enc, cb) {
            if (!chunk.isDirectory()) FILE_LIST.push(chunk.relative);
            cb(null, chunk);
        }));
});

/*gulp.task('test', function() {
    var fs = require('fs');
    var content = fs.readFileSync('./build/fonts/FontAwesome.otf', 'binary');
    console.log(content.charCodeAt(7));
    content = new Buffer(content, 'binary').toString('base64');
    var dec = new Buffer(content, 'base64').toString("ascii");
    console.log(content.substring(0, 40));
    console.log(dec.charCodeAt(7));
});*/

gulp.task('create-install-package', ['enum-files'], function() {
    var fs = require('fs');
    var append = '';
    for (var i = 0; i < FILE_LIST.length; i++) {
        console.log('Adding file:', FILE_LIST[i]);
        var content = fs.readFileSync('./build/' + FILE_LIST[i], 'binary');
        content = new Buffer(content, 'binary').toString('base64');
        var step = 32767;
        var k = step;
        while (k < content.length) {
            content = content.substring(0, k) + '\r\n' + content.substring(k, content.length);
            k += step;
        }
        append += `
<XData name="File${i}">
    <Description>${FILE_LIST[i]}</Description>
    <MimeType>text/plain</MimeType>
    <Data><![CDATA[${content}]]></Data>
</XData>`;
    }

    var p = require('./package.json');

    // Change exists Installer class
    var installer = fs.readFileSync('./DSW.Installer.xml', 'utf8');
    installer = installer.substring(0, installer.length - 11);
    installer += '<Class name="DSW.InstallerData">' + append + '</Class></Export>';
    fs.writeFileSync('./build/DSW.Installer.' +  p.version + '.xml', installer);
    console.log('DSW.Installer.xml was created!')
});


/* Generate jsdoc
gulp.task('jsdoc', function() {
    return gulp.src(['src/ * * /*.js', '!src/lib/*'])
        .pipe(jsdoc('./documentation'));
});*/
gulp.task('build-mobile', ['lint', 'minify', 'cssminify', 'concat-templates', 'copyfiles-mobile', 'cleanup'], function () {});

gulp.task('default', ['lint', 'minify', 'cssminify', 'concat-templates', 'copyfiles', 'cleanup'], function () {});

