
let path=require('path')
let fs = require('fs')
let http = require('http')
let request = require('request')

let server = '127.0.0.1'
let nssocket = require('nssocket')
require('songbird')


var outbound = new nssocket.NsSocket();
 outbound.connect(8001,server);


console.log("connected to 8001")

outbound.data('Broadcasting',function (data) {

	let jsondata = JSON.parse(data)

    console.log(jsondata)
    var filePath = jsondata.path 
    if (jsondata.action === 'delete') {
		fs.promise.unlink(filePath)
			.then(stat => console.log(filePath, ' deleted'))
	}
	else
	{
		console.log('Downloading the file ', filePath)

	  	 var file = fs.createWriteStream(filePath);

		 let options = {
	         url: 'http://localhost:8000/'+filePath,
	         method:'GET'
			}
	     console.log('in Proxy 2')

	    request(options,function (error, response, body) {
	     if (!error && response.statusCode == 200) {
		    console.log(body) // Show the HTML for the Google homepage. 
		    let stream =  fs.createWriteStream(filePath)
		   stream.once('open', function(fd) {
			  	stream.write(body)
			  	stream.end()
			})
		  }
    	})
	}
})