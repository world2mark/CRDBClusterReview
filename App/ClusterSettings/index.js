'use strict';



function FixedStringValue(incomingValue) {
    let fixedString = incomingValue;
    if (fixedString.constructor === String && fixedString.trim().length === 0) {
        fixedString = '<i style=\"color: red;\">&lt;empty string&gt;</i>';
    };
    // The "replace" is needed because EJS appends funny characters in the render...
    return fixedString.replace('µ', '&micro;');
};


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Cluster Settings');
    const LeftItems = LeftFragment.review_data.ClusterSettings;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Cluster Settings');
    const RightItems = RightFragment.review_data.ClusterSettings;

    for (const leftSetting of LeftItems) {
        const DiffLeftVal = FixedStringValue(leftSetting.value);

        const rightSetting = RightItems.find(item => item.variable === leftSetting.variable);
        if (rightSetting) {
            if (rightSetting.PleaseIgnore === true) {
                continue;
            };

            const DiffRightVal = FixedStringValue(rightSetting.value);

            if (DiffLeftVal !== DiffRightVal) {
                rightSetting.PleaseIgnore = true;
                Diffs.push({
                    Variable: leftSetting.variable,
                    DiffLeftVal: DiffLeftVal,
                    DiffRightVal: DiffRightVal
                });
            };
        } else {
            Diffs.push({
                Variable: leftSetting.variable,
                DiffLeftVal: DiffLeftVal,
                DiffRightVal: '<i style=\"color: red;\">&lt;missing&gt;</i>'
            });
        };


        leftSetting.PleaseIgnore = true;
    };

    for (const leftSetting of RightItems) {
        if (leftSetting.PleaseIgnore === true) {
            continue;
        };

        const DiffLeftVal = FixedStringValue(leftSetting.value);

        const rightSetting = LeftItems.find(item => item.variable === leftSetting.variable);
        if (!rightSetting) {
            Diffs.push({
                Variable: leftSetting.variable,
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: DiffLeftVal
            });
        };


        leftSetting.PleaseIgnore = true;
    };

    Diffs.sort((v1, v2) => {
        if (v1.Variable < v2.Variable) {
            return -1;
        };
        if (v1.Variable > v2.Variable) {
            return 1;
        };
        return 0;
    });

    return Diffs;
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
