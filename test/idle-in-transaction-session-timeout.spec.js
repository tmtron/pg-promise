const header = require('./db/header');

const promise = header.defPromise;
const options = {
    promiseLib: promise,
    noWarnings: true
};
const dbHeader = header(options);
const pgp = dbHeader.pgp;
const db = dbHeader.db;

const IDLE_TIMEOUT_MS = 100;
const SLEEP_TIME_SEC = 0.2;

describe('idle-in-transaction-session-timeout', () => {

    describe('recovery', () => {
        let status = 'connecting', error;
        beforeEach(done => {
            db.connect()
                .then(obj => {
                    status = 'success';
                    obj.done(); // release connection;
                }, reason => {
                    error = reason;
                    status = 'failed';//reason.error;
                })
                .catch(err => {
                    error = err;
                    status = 'exception';
                })
                .finally(done);
        });
        it('should get a new connection after the timeout', async (done) => {
            expect(status).toBe('success');
            expect(error).toBeUndefined();
            await db.any("SET idle_in_transaction_session_timeout TO $1;", IDLE_TIMEOUT_MS);
            try {
                await db.tx(async t => {
                    await new Promise(resolve => setTimeout(resolve, SLEEP_TIME_SEC * 1000));
                    return t.one("Select $1 as sleep_sec", SLEEP_TIME_SEC);
                });
                done('dbIdle must throw an exception');
            } catch (e) {
                expect(e.message).toContain('is not queryable');
            }
            try {
                const qryResult = await db.one("Select 1+1 as res");
                expect(qryResult.res).toEqual(2);
            } catch (e) {
                done('query after session timeout failed! '+e.message);
            }
            done();
        });
    });

});

if (jasmine.Runner) {
    const _finishCallback = jasmine.Runner.prototype.finishCallback;
    jasmine.Runner.prototype.finishCallback = function () {
        // Run the old finishCallback:
        _finishCallback.bind(this)();

        pgp.end(); // closing pg database application pool;
    };
}