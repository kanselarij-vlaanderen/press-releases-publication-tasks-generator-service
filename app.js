import {app, query} from 'mu';

app.post('/', function (req, res) {
	res.send({test: 'Hello mu-javascript-template'});
});
