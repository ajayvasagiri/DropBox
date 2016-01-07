let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')

let path = require('path')
let fs = require('fs')
let mime = require('mime-types')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let yargs = require('yargs')
let chokidar = require('chokidar')

require('songbird')
// require('longjohn')

let nssocket = require('nssocket');
let argv = require('yargs')
  .default('dir', process.cwd())
  .argv

//let bluebird = require('bluebird')
//bluebird.longStackTraces()

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const ROOT_DIR = path.resolve(path.join(argv.dir, 'client'))

const TCP_PORT = 8001

let app = express()

if(NODE_ENV == 'development')
{
	app.use(morgan('dev'))
}

app.listen(PORT, ()=> console.log('LISTENING at http://127.0.0.1:{PORT}'))


var sockets = [];
var server = nssocket.createServer(
    function (socket) {
        console.log('inside socket')
        sockets.push(socket);
        socket.data('Connecting', function (data) {
            console.log("There are now", sockets.length);

            for(var i=0, l=sockets.length; i<l; i++) {
                sockets[i].send('Broadcasting', 'data');
            }
        });
    }
    ).listen(TCP_PORT);
console.log(`LISTENING ${TCP_PORT} for Dropbox Clients`)

let watcher = chokidar.watch('.', {ignored: /[\/\\]\./,ignoreInitial: true})


// Add event listeners. 
watcher
  .on('add', path => broadCastData('write', false, path))
  .on('change', path => broadCastData('write', false, path))
  .on('unlink', path => broadCastData('delete', false, path));


app.get('*', setFileMetaData, sendHeaders, (req,res) =>
{
	if(res.body)
	{
		res.json(res.body)
		return
	}
	fs.createReadStream(req.filepath).pipe(res)
})

app.head('*', setFileMetaData, sendHeaders, (req,res) => res.end())

app.delete('*', setFileMetaData, (req, res, next) => 
{
	async ()=> {

		if(!req.stat) {
			res.send(400,'Invalid Path')
			return;
		}
		if(req.stat.isDirectory())	{
			await rimraf.promise(req.filepath)
		}
		else
			await fs.promise.unlink(req.filepath)
		res.end()

	}().catch(next)
})

app.put('*', setFileMetaData, setDirDetails, (req, res, next) =>
{
	async ()=> {
		if(req.stat) {
			res.send(405,'File exists')
			return;
		}
		await mkdirp.promise(req.dirPath)
		if(!req.isDirectory){
			req.pipe(fs.createWriteStream(req.filepath))
			res.end()
		}
	}().catch(next)	
})

app.post('*', setFileMetaData, setDirDetails, (req, res, next) =>
{
	async ()=> {

		if(!req.stat) {
			res.send(405,'File does not exists')
			return;
		}
		if(req.isDirectory) {
			res.send(405,'Path is a Directory')
			return;
		}
		await fs.promise.truncate(req.filepath,0)
		req.pipe(fs.createWriteStream(req.filepath))
		res.end()
	}().catch(next)	
})

function broadCastData(action, dir, path)
{
	let jsonString = '{ "action": "' + action + '","path":'
	jsonString = jsonString +  '"' + path + '","type": "'
	jsonString = jsonString + dir + '"}'

	for(var i=0, l=sockets.length; i<l; i++) {
        sockets[i].send('Broadcasting', jsonString);

    }
}

function setDirDetails(req, res, next)
{
		let filepath = req.filepath
		let endWithSlash = filepath.charAt(filepath.length-1) === path.sep
		let hasExt = path.extname(filepath) != ''
		req.isDirectory = endWithSlash || !hasExt
		req.dirPath = req.isDirectory ? filepath : path.dirname(filepath)
		next()
}

function setFileMetaData(req, res, next)
{

		let filepath = path.resolve(path.join(ROOT_DIR,req.url))
		if(filepath.indexOf(ROOT_DIR) != 0)		{
			res.send(400,'Invalid path provided')
			return;
		}
		req.filepath = filepath		
		fs.promise.stat(req.filepath)
		 	.then(stat => req.stat = stat, () => req.stat = null)
		 	.nodeify(next)
}

function sendHeaders(req, res, next)
{
	nodeify(async ()=> {
        if(!req.stat){
			res.send(400,'Invalid file')
			return;
		}
        if(req.stat.isDirectory()){
        	let files = await fs.promise.readdir(req.filepath)
        	res.body = JSON.stringify(files)
        	res.setHeader('Content-Length', res.body.length)
        	res.setHeader('Content-Type', 'application/text')        	
        	return
        }
        res.setHeader('Content-Length', req.stat.size)
        let contentType = mime.contentType(path.extname(req.filepath))
        res.setHeader('Content-Type', contentType)
	}(), next)
}

