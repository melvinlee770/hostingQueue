const express = require('express'); // DO NOT DELETE
const cors = require('cors');
const morgan = require('morgan');
const app = express(); // DO NOT DELETE
const port = 3000; // Use port no. 3000


const database = require('./database');
const { concat, queue } = require('async');
const { json } = require('express');


app.use(morgan('dev'));
app.use(cors());
app.use(express.json())

// Dependencies
const moment = require('moment');

// Validation w/ JSON Schema 
const validator = require('./jsonschema')

/**
 * =====================================================================
 * ========================== CODE STARTS HERE =========================
 * =====================================================================
=======
 */


/**
 * ========================== SETUP APP =========================
 */

/**
 * JSON Body
 */

/**
 * ========================== RESET API =========================
 */

/** WORKING
 * Reset API 
 */

app.post('/reset', function (req, res, next) {
    database.resetTables(function (err, result) {
    if (!err) {
    res.status(200).send("Table Reset Successfully")
    }
    else {
    return next({ status: 500, message: 'Unexpected error' })
    }
    })
   })

/**
 * ========================== COMPANY =========================
 */

/** WORKING
 * Company: Create Queue 
 */

app.post('/company/queue', function (req, res, next) {

    const queue_id = req.body.queue_id;
    const company_id = req.body.company_id;
    
    if (!queue_id || !company_id) {
    return next({ status: 400, code: 'INVALID_JSON_BODY' })
    }
    if (queue_id.length < 10) {
    return next({ status: 400, error: 'QueueID should not be less than 10 digits', code: 'INVALID_JSON_BODY' })
    }
    if (queue_id.length > 10) {
    return next({ status: 400, error: 'QueueID should not be more than 10 digits', code: 'INVALID_JSON_BODY' })
    }
    if (company_id < 1000000000 || company_id > 9999999999) {
    return next({ status: 400, error: 'CompanyID must be in 10 digits', code: 'INVALID_JSON_BODY' })
    }
    if (typeof (company_id) !='number') {
        return next({ status: 400, error: 'CompanyID must be in numeric form', code: 'INVALID_JSON_BODY'})
    }
    if (typeof (queue_id) !='string') {
    return next({ status: 400, error: 'QueueID must be in a string', code: 'INVALID_JSON_BODY'})
    }
    database.createQueue(queue_id, company_id, function (err, result) {
    if (!err) {
    res.status(201).send()
    }
    else if (err.code == 'QUEUE_EXISTS') {
    return res.status(422).json({ error: 'Queue ID '+ queue_id +' already exists', code: 'QUEUE_EXISTS' })
    }
    else if (err) {
    return next({ status: 500, message: error.message })
    }
    })
   })

/** WORKING
 * Company: Update Queue 
 */

app.put('/company/queue', function (req, res, next) {

    const queue_status = req.body.status
    const queue_id = req.query.queue_id
    
    if (!queue_id || !queue_status) {
    return next({ status: 400, code: 'INVALID_QUERY_STRING' })
    }
    if (queue_id.length < 10) {
    return next({ status: 400, error: 'QueueID should be less than 10 digits', code: 'INVALID_QUERY_STRING' })
    }
    if (queue_id.length > 10) {
    return next({ status: 400, error: 'QueueID should be not more than 10 digits', code: 'INVALID_QUERY_STRING' })
    }
    if (typeof (queue_id) !='string') {
    return next({ status: 200, error: 'QueueID should be in string', code: 'INVALID_QUERY_STRING'})
    }
    if (queue_status !="ACTIVATE" && queue_status !="DEACTIVATE") {
    return next({ status: 400 , error: 'Error input of status', code: 'INVALID_JSON_BODY'})
    }
    database.updateQueue(queue_status, queue_id, function (err, result) {
    if (!err) {
    res.status(200).send()
    }
    else if (err.code == 'UNKNOWN_QUEUE') {
    return next({ status: 404, error: 'Queue ID ' + queue_id + ' not found', code: 'UNKNOWN_QUEUE' })
    }
    else {
    return next({ status: 500, message: error.message })
    }
    })
    
   })



/**
 * Company: Server Available 
 */

app.put(`/company/server`, function (req, res, next) {
    var fk_queue_id = req.body.queue_id;

    var queueIDvalidator = validator.valid(fk_queue_id, validator.checkQueueID);

    if (queueIDvalidator) {
        console.log(fk_queue_id)
        var queue_id = fk_queue_id.toUpperCase();
        database.serverAvailable(queue_id).then((result) => {
            if (result == 0) {
                // No Customer in Queue
                res.status(200).send({
                    "customer_id": 0
                })
            } else if (result == 1) {
                //  Non-existent Queue ID
                res.status(404).send({
                    "error": `Queue ID '${fk_queue_id}' Not Found`,
                    "code": "UNKNOWN_QUEUE"
                })
            } else {
                // Success Response
                res.status(200).send({
                    "customer_id": result
                })
            }
        })
    }
    else if (!queueIDvalidator) {
            return next({ status: 400, error: 'QueueID cannot be less than 10 digits', code: 'INVALID_JSON_BODY' })
    }
    else {
        res.status(500).send({ "Error": "Unable to establish a connection with the database", "Code": errorCode });
    }
})
    

/**
 * Company: Arrival Rate
 */

app.get('/company/arrival_rate', function (req, res, next) {

    var queue_ID = req.query.queue_id;
    var from = req.query.from;
    var duration = parseInt(req.query.duration);

    var queueIDvalidator = validator.valid(queue_ID, validator.checkQueueID);
    var timeValidator = moment(from).isValid();
    var durationValidator = validator.valid(duration, validator.checkDuration);

    // JSON validation valid
    if (queueIDvalidator && timeValidator && durationValidator) {

        // Connect to database
        database.arrivalRate(queue_ID.toUpperCase(), from, duration, function (err, result) {
            if (!err) {
                // Success
                res.status(200).send(result);
            }
            else {
                var errorCode = err || "UNEXPECTED_ERROR";

                if (errorCode == "UNKNOWN_QUEUE") {
                    res.status(404).send({ "Error": "Queue ID" + queue_id + "Not Found", "Code": errorCode });
                }
                else if (errorCode == "UNKNKOWN_TIME") {
                    res.status(404).send({ "Error": "The arrival rate does not exist ", "Code": errorCode });
                }
                else {
                    res.status(500).send({ "Error": "Unable to establish a connection with the database", "Code": errorCode });
                }
            }
        })
    }
    else if (!queueIDvalidator) {
        if (queue_id.length < 10) {
            return next({ status: 400, error: 'QeueueID cannot be less than 10 digits', code: 'INVALID_JSON_BODY' })
        }
        if (queue_id.length > 10) {
            return next({ status: 400, err: 'QueueID cannot be more than 10 digits', code: 'INVALID_JSON_BODY' })

        }
        if (typeof (queue_id) != 'string') {
            return next({ status: 400, error: 'QueueID should be in string', code: 'INVALID_JSON_BODY' })
        }
    }
    else if (!timeValidator) {
        return next({ status: 400, error: 'From not following format', code: 'INVALID_QUERY_STRING' })
    }
    else if (!durationValidator) {
        return next({ status: 400, error: 'Duration not valid', code: 'INVALID_QUERY_STRING' })
    }
    else {
        next({ body: { error: err.message, code: 'UNEXPECTED_ERROR' }, status: 500 });
    }
});


/**
 * ========================== CUSTOMER =========================
 */

/**
 * Customer: Join Queue
 */

app.post('/customer/queue', function (req, res, next) {

    const customer_id = req.body.customer_id;
    const queue_id = req.body.queue_id;
    
    if (!customer_id || !queue_id) {
    return next({ status: 400, code: 'INVALID_JSON_BODY' })
    }
    if (customer_id < 1000000000 || customer_id > 9999999999) {
    return next({ status: 400, error: 'CustomerID must be in 10 digits', code: 'INVALID_JSON_BODY' })
    }
    if (queue_id.length < 10) {
    return next({ status: 400, error: 'QeueueID cannot be less than 10 digits', code: 'INVALID_JSON_BODY' })
    }
    if (queue_id.length > 10) {
    return next({ status: 400, err: 'QueueID cannot be more than 10 digits', code: 'INVALID_JSON_BODY' })
    }
    if (typeof (queue_id) !='string') {
    return next({ status: 400, error: 'QueueID should be in string', code: 'INVALID_JSON_BODY'})
    }
    if (typeof (customer_id) !='number') {
    return next({ status: 400, error: 'CustomerID must be numeric', code: 'INVALID_JSON_BODY'})
    }

    database.joinQueue(customer_id, queue_id, function (err, result) {
    if (!err) {
    res.status(201).send()
    }
    else if (err.code == 'NotThisQueueID') {
    return next({ status: 404, error: 'Queue ID ' + queue_id + ' not found', code: 'UNKNOWN_QUEUE' })
    }
    else if (err.code == 'QueueIDInactive') {
    return next({ status: 422, error: 'Queue ' + queue_id + ' is inactive', code: 'INACTIVE_QUEUE' })
    }
    else if (err.code == 'TheCustomerID&QueueID_Exists') {
    return next({ status: 422, code:'ALREADY_IN_QUEUE'})
    }
    else{
    return next({ status: 500, message: error.message })
    }
    })
   })

/**
 * Customer: Check Queue 
 */

app.get ('/customer/queue', function (req,res) {
    const queue_id = req.query.queue_id;
    const customer_id = req.query.customer_id;
    // if (!queue_id) {
    //     return next({ status: 400, code: 'INVALID_JSON_BODY' })
    // }
    var queueidvalid = validator.valid(queue_id, validator.checkQueueID)
    var customeridvalid = validator.valid(customer_id, validator.customerIDinputSchema);
    if (customer_id == '') customeridvalid = true;
    if (queueidvalid && customeridvalid) {
        database.checkQueue(queue_id.toUpperCase(), customer_id, function (err, result) {
            if (!err) {
                res.status(201).send(result);
            }
        })
    }
    else if (!queueidvalid) {
        if (queue_id.length < 10) {
            return next({ status: 400, error: 'QeueueID cannot be less than 10 digits', code: 'INVALID_JSON_BODY' })
        }
        if (queue_id.length > 10) {
            return next({ status: 400, err: 'QueueID cannot be more than 10 digits', code: 'INVALID_JSON_BODY' })

        }
        if (typeof (queue_id) != 'string') {
            return next({ status: 400, error: 'QueueID should be in string', code: 'INVALID_JSON_BODY' })
        }
    }
    else if (!customeridvalid) {
        if (customer_id < 1000000000 || customer_id > 9999999999) {
            return next({ status: 400, error: 'CustomerID must be in 10 digits', code: 'INVALID_JSON_BODY' })
        }
        if (typeof (customer_id) != 'number') {
            return next({ status: 400, error: 'CustomerID must be numeric', code: 'INVALID_JSON_BODY' })
        }
    }
    else {
        var errorCode = err || "UNEXPECTED_ERROR";

        if (errorCode == "UNKNKOWN_QUEUE") {
            res.status(404).send({ "Error": "Queue ID" + queue_id + "Not Found", "Code": errorCode });
        }
        else {
            res.status(500).send({ "Error": "Unable to establish a connection with the database", "Code": errorCode });
        }
    }
})

/**
 * ========================== UTILS =========================
 */

/**
 * 404
 */

/**
 * Error Handler
 */

app.use(function (err, req, res, next) {
    console.log(err)
    res.status(err.status).json(err);
})

function tearDown() {
    // DO NOT DELETE
    return database.closeDatabaseConnections();
}

/**
 *  NOTE! DO NOT RUN THE APP IN THIS FILE.
 *
 *  Create a new file (e.g. server.js) which imports app from this file and run it in server.js
 */

module.exports = { app, tearDown }; // DO NOT DELETE