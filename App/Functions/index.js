'use strict';


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Functions');
    const LeftItems = LeftFragment.review_data.Functions;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Functions');
    const RightItems = RightFragment.review_data.Functions;

    for (const leftSetting of LeftItems) {
        const leftSettingJSON = JSON.stringify(leftSetting);
        const rightSetting = RightItems.find(item => JSON.stringify(item) === leftSettingJSON);

        if (rightSetting) {
            if (rightSetting.PleaseIgnore === true) {
                continue;
            };

            const rightSettingJSON = JSON.stringify(rightSetting);

            if (leftSettingJSON !== rightSettingJSON) {
                Diffs.push({
                    FunctionName: leftSetting.function_name,
                    DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                    DiffRightVal: JSON.stringify(rightSetting, null, 2),
                });
            };
            rightSetting.PleaseIgnore = true;
        } else {
            Diffs.push({
                FunctionName: leftSetting.function_name,
                DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                DiffRightVal: '<i style=\"color: red;\">&lt;missing&gt;</i>'
            });
        };


        leftSetting.PleaseIgnore = true;
    };

    for (const leftSetting of RightItems) {
        if (leftSetting.PleaseIgnore === true) {
            continue;
        };

        const leftSettingJSON = JSON.stringify(leftSetting);
        const rightSetting = LeftItems.find(item => JSON.stringify(item) === leftSettingJSON);

        if (!rightSetting) {
            Diffs.push({
                FunctionName: leftSetting.function_name,
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: JSON.stringify(leftSetting, null, 2)
            });
        };


        leftSetting.PleaseIgnore = true;
    };


    // Removal of all the PleaseIgnore properties
    const cleanDiffs = Diffs.map(myDiff => ({
        FunctionName: myDiff.FunctionName,
        DiffLeftVal: myDiff.DiffLeftVal,
        DiffRightVal: myDiff.DiffRightVal
    }));

    cleanDiffs.sort((v1, v2) => {
        if (v1.FunctionName < v2.FunctionName) {
            return -1;
        };
        if (v1.FunctionName > v2.FunctionName) {
            return 1;
        };
        return 0;
    });

    return cleanDiffs;
};



exports.GenerateHTML = (ReviewsToCompare, DiffsJSON) => {

    const PATH = require('path');
    const FS = require('fs');
    const EJS = require('ejs');

    const EJSTemplate = FS.readFileSync(PATH.join(__dirname, 'template.ejs'), 'utf8');

    return EJS.render(EJSTemplate, {
        ReviewsToCompare: ReviewsToCompare,
        DiffsJSON: DiffsJSON
    });
};
