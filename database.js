const { queue } = require('async');
const { Pool, Client, query } = require('pg');
const connectionString = 'postgres://jfudmddn:kwDMSx0sadGy54iJiTKG8SUq3Uq7hV1a@lallah.db.elephantsql.com:5432/jfudmddn'

// Using postgres-node's Pool to manage database connection
const pool = new Pool ({
    connectionString: connectionString,
    max: 4,
    statement_timeout: 10000,
})

// Dependencies
const moment = require('moment');

pool.connect();

// Reset Table function
function resetTables(callback) {
    
    const sql = 'DELETE FROM customers; DELETE FROM queue;'

    pool.query(sql)

    .then (function (result) { 

    console.log ('Queue reset successfully!')

    callback(null, result)
    return result
    })

    .catch(function (error) {
    return error;
    })
   }

// Create Queue Function 
function createQueue(queue_id, company_id, callback) {
 
    const sql = 'INSERT INTO queue VALUES (UPPER($1), $2)';
    
    pool.query(sql, [queue_id, company_id])

    .then(function (result) {
    console.log ('You successful created a new queue ' + queue_id + " from company " + company_id)

    callback(null, result)
    return result
    })

    .catch(function (error) {

    if (error.code == '23505') {
    callback({ code: 'QUEUE_EXISTS' })
    }

    return error
    })
   }

// Update Queue Function 

function updateQueue(queue_status, queue_id, callback) {

    const sql = 'UPDATE queue SET status = (UPPER($1)) WHERE queue_id = (UPPER($2))';
    
    pool.query(sql, [queue_status, queue_id])

    .then(function (result) {

    console.log ('You successful updated queue ' + queue_id )

    if (result.rowCount == 1) {

    callback(null, result);
    return result;
    }
    
    else if (result.rowCount == 0) {

    callback ({code: 'UNKNOWN_QUEUE'});
    return error;
    }
    })
    .catch(function (error) {
        return error
        })
       }

// Server Available Function 

function serverAvailable(fk_queue_id) {
    const query1 = `SELECT * from queue where queue_id = $1`

    const query2 = `SELECT min(id),customer_id FROM customers WHERE served = false AND fk_queue_id = $1 GROUP BY id ORDER BY 1 LIMIT 1`
    const query3 = `UPDATE customers SET served = true where customer_id = $1 and fk_queue_id= $2`
    
    return pool.query(query1, [fk_queue_id]).then((result1) => {
        var result1 = result1.rows;
        console.log(result1)
        if(result1 == []) return 1;
        return pool.query(query2, [fk_queue_id]).then((result2) => {
            var result2 = result2.rows;
            console.log(result2)
            console.log(`Next Customer to be served: ${result2[0].customer_id}`);
            var customer_id = result2[0].customer_id
            // Able to update & select (QUERY 1 & 2 OK)
            if (result1 !== [] && result2 !== []) {
                console.log('next customer')
                return pool.query(query3, [customer_id,fk_queue_id]).then(() => {
                    return parseInt(customer_id);
                })
                // queue id exist but no customers
            } else if (result1 !== [] && result2 == []) {
                console.log('no customer')
                return 0;
            }
        })
            .catch((err2) => {
                console.log('SELECT Error', err2);
                return err2;
            })
    })
        .catch((err1) => {
            console.log('UPDATE Error', err1);
            return err1;
        })
};

// Arrival Rate Function

function arrivalRate(queue_id, from, duration, callback) {

    const fromDate = moment(from).subtract(8, 'hours');
    const date = moment(fromDate).format('YYYY-M-D HH:mm:ss');
    const durationIn = parseInt(duration) * 60;
    const newDate1 = moment(from).add(durationIn, 'seconds');
    const newDate = moment(newDate1).format('YYYY-M-D HH:mm:ss');

    const whenQueueExists = `SELECT * FROM queue WHERE queue_id = $1`;
    const arrivalRateSQL = `SELECT created_at AT TIME ZONE 'SGT' at time zone 'GMT' AS timestamp , count(*) FROM customers WHERE fk_queue_id = $1 AND created_at  BETWEEN $2 AND $3 GROUP BY created_at ORDER BY timestamp;`;

    return pool.query(whenQueueExists, [queue_id])

        .then(result => {
            var res = result.rows;
            console.log(res);
            if (res == '') {
                throw new Error("UNKNOWN_QUEUE");
            }
        })
        .then(() => {
            pool.query(arrivalRateSQL, [queue_id, date, newDate])
                .then(res => {
                    var result2 = res.rows;
                    console.log(result2);
                    if (result2 == '') {
                        throw new Error("UNKNKOWN_TIME");
                    }
                    else {
                        callback(null, result2);
                    }
                })
                .catch(b => {
                    console.error(b.stack, b.message)
                    callback(b.message, null);
                });
        })
        .catch(b => {
            console.error(b.stack, b.message)
            callback(b.message, null);
        });
}

// Join Queue Function

function joinQueue(customer_id, queue_id, callback) {

    const sqlCheck = 'SELECT * FROM queue WHERE queue_id = UPPER ($1)'
    const sql = 'INSERT INTO customers (customer_id, fk_queue_id) values ($1, UPPER($2))'
    
    pool.query(sqlCheck, [queue_id]) 

    .then(function (result) {

    if(result.rowCount == 0) {

    callback({code: 'NotThisQueueID'})
    return error
    }
    else if(result.rows[0].status == 'INACTIVE' || result.rows[0].status == 'DEACTIVATE'){

    callback({code: 'QueueIDInactive'})
    return error
    }

    else if(result.rowCount == 1 && result.rows[0].status == 'ACTIVATE') {

    return pool.query(sql, [customer_id, queue_id])

    .then( function (result) {

    console.log('CustomerID '+customer_id+' successfully joined the queue with queueID '+queue_id)

    callback(null, result)
    return result
    })
    }
    })
    .catch(function (error) {

    if (error.code == '23505') {

    callback({code: 'TheCustomerID&QueueID_Exists'})
    return error
    }
    else{

    console.log(error)
    callback({code: 'Unexpected error'})
    return error
    }
    })
   }

// Check Queue Function 

function checkQueue(queue_id, customer_id, callback) {
    const checkQueueSQL = 
        `SELECT COUNT(*) FILTER(WHERE c.fk_queue_id = $1 AND served = false) total, 
        CASE WHEN EXISTS (SELECT created_at FROM customers WHERE fk_queue_id = $1 AND customer_id = $2) 
        THEN (COUNT(*) FILTER(WHERE fk_queue_id = $1 AND created_at < 
        (SELECT created_at FROM customers WHERE fk_queue_id = $1 AND customer_id = $2 ) AND served = false)) ELSE -1 END ahead 
        FROM customers c WHERE fk_queue_id = $1 GROUP BY c.fk_queue_id`;
    
        pool.query(checkQueueSQL, [queue_id,customer_id])
        .then(function (result) {
            var outcome = {};
            if (result.rows.length==0) {
                throw new Error("UNKNOWN_QUEUE");
            }
            if (result.rows.length){
                if (result.rows[0].ahead>=0) {
                    // result.rows[0].status="ACTIVE"
                    outcome=result.rows[0];
                } else {
                    // result.rows[0].status="INACTIVE"    
                    outcome=result.rows[0];            
                }
            }           
            callback(null, outcome);
            
        })
        .catch(e =>  {
            console.log(e.stack, e.message);
            callback(e.message, null);
        });
        
}


function closeDatabaseConnections() {
    /**
     * return a promise that resolves when all connection to the database is successfully closed, and rejects if there was any error.
     */
}

module.exports = {
    resetTables,
    closeDatabaseConnections,
    createQueue,
    updateQueue,
    arrivalRate,
    serverAvailable,
    checkQueue,
    joinQueue
};