import {app, query} from 'mu';

app.get('/', function (req, res) {
	res.send({test: 'Hello mu-javascript-template'});
});
