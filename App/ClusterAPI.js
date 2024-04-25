'use strict';



function RunRequest(theInterface, requestOpts) {
    return new Promise((resolve, reject) => {

        const ReqObj = theInterface.request(requestOpts, myResp => {
            const dataBlocks = [];

            myResp.setEncoding('utf8');

            myResp.on('data', chunk => {
                dataBlocks.push(chunk);
            });

            myResp.on('end', () => {
                try {
                    const finalData = dataBlocks.join('');
                    const contentType = myResp.headers['content-type'];
                    if (contentType && contentType.includes('application/json')) {
                        resolve(JSON.parse(finalData));
                    } else {
                        resolve(finalData);
                    };
                } catch (err) {
                    reject(err);
                };
            });
        });

        ReqObj.on('error', err => {
            reject(err);
        });

        ReqObj.end();
    });
};



const HTTP = require('http');
const HTTPS = require('https');



function GenericRequest(theURL, method, theHeaders) {

    const URLQuery = new URL(theURL);

    const requestOpts = {
        hostname: URLQuery.hostname,
        port: URLQuery.port,
        path: `${URLQuery.pathname}${URLQuery.search}`,
        method: method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
            'Connection': 'keep-alive'
        }
    };

    if (theHeaders) {
        Object.keys(theHeaders).forEach(headerName => {
            requestOpts.headers[headerName] = theHeaders[headerName];
        });
    };

    return RunRequest(HTTPS, requestOpts).catch(err => {
        if (err.code !== 'EPROTO') {
            throw err;
        };
        return RunRequest(HTTP, requestOpts);
    });
};


exports.SignIn = async consoleURL => {
    const URLQuery = new URL(consoleURL);

    const MyURLString = [`${URLQuery.protocol}//${URLQuery.hostname}`];

    if (URLQuery.port) {
        MyURLString.push(':');
        MyURLString.push(URLQuery.port);
    };

    MyURLString.push('/api/v2/login/?username=');
    MyURLString.push(URLQuery.username);
    MyURLString.push('&password=');
    MyURLString.push(encodeURIComponent(URLQuery.password));

    const results = await GenericRequest(MyURLString.join(''), 'POST', {
        'content-type': 'application/x-www-form-urlencoded'
    });

    return results.session;
};


exports.GetNodes = async (consoleURL, sessionID) => {
    const URLQuery = new URL(consoleURL);
    const sessionHeader = {};
    if (sessionID) {
        sessionHeader['X-Cockroach-API-Session'] = sessionID;
    };

    const MyURLString = [`${URLQuery.protocol}//${URLQuery.hostname}`];
    if (URLQuery.port) {
        MyURLString.push(':');
        MyURLString.push(URLQuery.port);
    };
    MyURLString.push('/api/v2/nodes/');

    const results = await GenericRequest(MyURLString.join(''), 'GET', sessionHeader);
    return results.nodes;
};
