const dboperations = require('./dboperations');

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
const { request, response } = require('express');
var app = express();
var router = express.Router();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
    origin: '*'
}));
app.use('/api/cbs', router);

router.use((request, response, next) => {
    //write authen here

    response.setHeader('Access-Control-Allow-Origin', '*'); //หรือใส่แค่เฉพาะ domain ที่ต้องการได้
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Credentials', true);

    console.log('middleware');
    next();
});

router.route('/carbook').post((request, response) => {

    let bookData = { ...request.body };
    dboperations.carBook(bookData).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.setStatus(500);
    });

});

router.route('/reqpermit').post((request, response) => {

    let bookData = { ...request.body };
    dboperations.reqPermit(bookData).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.setStatus(500);
    });

});

router.route('/denybook').post((request, response) => {

    let bookData = { ...request.body };
    dboperations.denyBook(bookData).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.setStatus(500);
    });

});

router.route('/permitbook').post((request, response) => {

    let bookData = { ...request.body };
    dboperations.permitBook(bookData).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.setStatus(500);
    });

});

router.route('/userecbook').post((request, response) => {

    let bookData = { ...request.body };
    dboperations.useRecBook(bookData).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.setStatus(500);
    });

});

router.route('/getcartype').get((request, response) => {

    dboperations.getCarType().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getfilteredcar/:fromDate/:toDate/:schedId').get((request, response) => {

    dboperations.getFilteredCar(request.params.fromDate, request.params.toDate, request.params.schedId).then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getcar').get((request, response) => {

    dboperations.getCar().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getdriver').get((request, response) => {

    dboperations.getDriver().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getallsched').get((request, response) => {

    dboperations.getAllSched().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getallschedtoday').get((request, response) => {

    dboperations.getAllSchedToday().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getschedbyreqid/:pid').get((request, response) => {

    dboperations.getSchedByReqId(request.params.pid).then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getschedbydeptid/:viewId/:deptId').get((request, response) => {

    dboperations.getSchedByDeptId(request.params.viewId, request.params.deptId).then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getpermitreqsched').get((request, response) => {

    dboperations.getPermitReqSched().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getpermitsched').get((request, response) => {

    dboperations.getPermitSched().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getdrvsched').get((request, response) => {

    dboperations.getDrvSched().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getstatcntr').get((request, response) => {

    dboperations.getStatCntr().then(result => {
        response.json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

var port = process.env.PORT;
app.listen(port);
console.log('CBS API is running at ' + port);