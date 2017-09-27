var fs = require('fs');
var express = require('express');
var path = require('path');

var data = fs.readFileSync("orderbook");
//data = JSON.parse(data);

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/data', function(req, res){
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
});


app.listen("80");