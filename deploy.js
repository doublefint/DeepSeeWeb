
const spawn = require('child_process').spawn
const conf = require('./deploy-config')

const deploy = ( file, cb ) => {

    // C:/Cache/bin/cache.exe -s C:\InterSystems\Cache\mgr -U %%SYS <%CD%\build.cos
    const cacheexe = conf.exePath // C:/Cache/bin/cache.exe
    const args = [  
            "-s", conf.mgrPath // C:\InterSystems\Cache\mgr
    ];

    if ( conf.namespace ) {
        args.push( '-U' )
        args.push( conf.namespace )
    }
    
    const child = spawn( cacheexe, args )
    if ( !child.pid ){
        return console.log( 'can\'t spawn child proceess with cache.exe' )    
    }

    child.stdout.pipe( process.stdout )

    child.on( 'error', ( err ) => {
        
        let ecode = err.code 
        let message = err.message || 'Can\'t execute cache.exe'
        
        if ( err.code === 'ENOENT' ) {
            message = `The 'cache.exe' program was not found`
        } 

        console.log( message )
        
    })
    child.stderr.on( 'data', data => console.log( 'ERR:', data.toString() ) )
    
    // wait greetings
    child.stdout.on( 'data', data => console.log( data.toString() ) )
    child.stdout.on( 'end', cb || ( ()=>{} ) )

    child.stdin.setEncoding( 'utf-8' )
    const run = cmd => child.stdin.write( cmd + '\n' )
    
    run( conf.username ) 
    run( conf.password ) 
    run( 'd $system.OBJ.Load("' + file + '", "cuko")' )
    run( 'd ##class(DSW.Installer).setup()' )    
    run( 'halt' )

}

module.exports = deploy