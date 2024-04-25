'use strict';


const PATH = require('path');
const FS = require('fs');


const CaptureClusterData = require('./CaptureClusterData');
const GenerateReport = require('./GenerateReport');


const MyJSON = require(PATH.join('..', 'config.json'));

function ObfuscatePW(connStr) {
    // obfuscate PW
    const atSignSplit = connStr.split('@');
    if (atSignSplit.length !== 2) {
        return connStr;
    };

    const slashslashSplit = atSignSplit[0].split('//');

    const UIDPWSplit = slashslashSplit[1].split(':');
    const combinedConnStrNoPW = [slashslashSplit[0], '//', UIDPWSplit[0]];
    if (UIDPWSplit.length === 2) {
        combinedConnStrNoPW.push(':********');
    };
    combinedConnStrNoPW.push('@');
    combinedConnStrNoPW.push(atSignSplit[1]);
    return combinedConnStrNoPW.join('');
};


async function RunCaptureAndCompare() {

    await CaptureClusterData.Run(MyJSON.LeftCluster);
    await CaptureClusterData.Run(MyJSON.RightCluster);

    MyJSON.LeftCluster.ConnSQL = ObfuscatePW(MyJSON.LeftCluster.ConnSQL);
    MyJSON.LeftCluster.ConnUI = ObfuscatePW(MyJSON.LeftCluster.ConnUI);
    MyJSON.RightCluster.ConnSQL = ObfuscatePW(MyJSON.RightCluster.ConnSQL);
    MyJSON.RightCluster.ConnUI = ObfuscatePW(MyJSON.RightCluster.ConnUI);

    const HTMLResults = await GenerateReport.GenerateHTML(MyJSON);

    const TSNow = Date.now();
    FS.writeFileSync(PATH.join(__dirname, '..', `CRDB-Compare-Results-${TSNow}.json`), JSON.stringify(MyJSON, 0, 2));
    FS.writeFileSync(PATH.join(__dirname, '..', `CRDB-Compare-Results-${TSNow}.html`), HTMLResults);
};


RunCaptureAndCompare().catch(err => {
    console.error(err);
});