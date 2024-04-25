'use strict';


function GetRelationName(theSetting) {
    if (theSetting) {
        return theSetting
    };
    return '<i style=\"color: red;\">&lt;n/a&gt;</i>';
};


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Grants');
    const LeftItems = LeftFragment.review_data.Grants;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Grants');
    const RightItems = RightFragment.review_data.Grants;

    for (const leftSetting of LeftItems) {

        const rightSetting = RightItems.find(item => item.relation_name === leftSetting.relation_name && item.grantee === leftSetting.grantee);

        if (rightSetting) {
            if (rightSetting.PleaseIgnore === true) {
                continue;
            };

            let differenceFound = false;

            if (leftSetting.privilege_type !== rightSetting.privilege_type) {
                differenceFound = true;
            };

            if (leftSetting.is_grantable !== rightSetting.is_grantable) {
                differenceFound = true;
            };

            if (differenceFound) {
                Diffs.push({
                    Relation: GetRelationName(leftSetting.relation_name),
                    DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                    DiffRightVal: JSON.stringify(rightSetting, null, 2),
                });
            };
            rightSetting.PleaseIgnore = true;
        } else {
            Diffs.push({
                Relation: GetRelationName(leftSetting.relation_name),
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
                Relation: GetRelationName(leftSetting.relation_name),
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: JSON.stringify(leftSetting, null, 2)
            });
        };

        leftSetting.PleaseIgnore = true;
    };


    // Removal of all the PleaseIgnore properties
    const cleanDiffs = Diffs.map(myDiff => ({
        Relation: myDiff.Relation,
        DiffLeftVal: myDiff.DiffLeftVal,
        DiffRightVal: myDiff.DiffRightVal
    }));

    cleanDiffs.sort((v1, v2) => {
        if (v1.Relation < v2.Relation) {
            return -1;
        };
        if (v1.Relation > v2.Relation) {
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
