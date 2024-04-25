'use strict';


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Roles/Users');
    const LeftItems = LeftFragment.review_data.RolesUsers;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Roles/Users');
    const RightItems = RightFragment.review_data.RolesUsers;

    for (const leftSetting of LeftItems) {
        const rightSetting = RightItems.find(item => item.username === leftSetting.username);

        if (rightSetting) {
            if (rightSetting.PleaseIgnore === true) {
                continue;
            };

            if (JSON.stringify(leftSetting) !== JSON.stringify(rightSetting)) {
                Diffs.push({
                    UserName: leftSetting.username,
                    DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                    DiffRightVal: JSON.stringify(rightSetting, null, 2),
                });
            };
            rightSetting.PleaseIgnore = true;
        } else {
            Diffs.push({
                UserName: leftSetting.username,
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

        const rightSetting = LeftItems.find(item => item.username === leftSetting.username);

        if (!rightSetting) {
            Diffs.push({
                UserName: leftSetting.username,
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: JSON.stringify(leftSetting, null, 2)
            });
        };


        leftSetting.PleaseIgnore = true;
    };


    // Removal of all the PleaseIgnore properties
    const cleanDiffs = Diffs.map(myDiff => ({
        UserName: myDiff.UserName,
        DiffLeftVal: myDiff.DiffLeftVal,
        DiffRightVal: myDiff.DiffRightVal
    }));

    cleanDiffs.sort((v1, v2) => {
        if (v1.UserName < v2.UserName) {
            return -1;
        };
        if (v1.UserName > v2.UserName) {
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
