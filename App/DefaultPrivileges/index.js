'use strict';


function GenerateObjectDiffs(UserName, leftObj, rightObj, Diffs) {
    for (const leftSetting of leftObj) {
        if (leftSetting.PleaseIgnore === true) {
            continue;
        };

        const leftSettingJSON = JSON.stringify(leftSetting);
        const rightSetting = rightObj.find(item => JSON.stringify(item) === leftSettingJSON);

        if (rightSetting) {
            if (rightSetting.PleaseIgnore === true) {
                continue;
            };

            const rightSettingJSON = JSON.stringify(rightSetting);

            if (leftSettingJSON !== rightSettingJSON) {
                Diffs.push({
                    UserName: UserName,
                    DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                    DiffRightVal: JSON.stringify(rightSetting, null, 2),
                });
            };
            rightSetting.PleaseIgnore = true;
        } else {
            Diffs.push({
                UserName: UserName,
                DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                DiffRightVal: '<i style=\"color: red;\">&lt;missing&gt;</i>'
            });
        };


        leftSetting.PleaseIgnore = true;
    };

    for (const leftSetting of rightObj) {
        if (leftSetting.PleaseIgnore === true) {
            continue;
        };

        const leftSettingJSON = JSON.stringify(leftSetting);
        const rightSetting = leftObj.find(item => JSON.stringify(item) === leftSettingJSON);

        if (!rightSetting) {
            Diffs.push({
                UserName: UserName,
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: JSON.stringify(leftSetting, null, 2)
            });
        };


        leftSetting.PleaseIgnore = true;
    };

};


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Default Privileges');
    const LeftItems = LeftFragment.review_data.DefaultPrivileges;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Default Privileges');
    const RightItems = RightFragment.review_data.DefaultPrivileges;

    GenerateObjectDiffs('<i>&lt;All Roles&gt;</i>', LeftItems.AllRoles, RightItems.AllRoles, Diffs);

    for (const leftRole of LeftItems.Roles) {
        const rightRole = RightItems.Roles.find(item => item.username === leftRole.username);
        if (rightRole) {
            GenerateObjectDiffs(leftRole.username, leftRole.DefaultPrivileges, rightRole.DefaultPrivileges, Diffs);
        } else {
            GenerateObjectDiffs(leftRole.username, leftRole.DefaultPrivileges, [], Diffs);
        };
    };

    for (const rightRole of RightItems.Roles) {
        const leftRole = LeftItems.Roles.find(item => item.username === rightRole.username);
        if (leftRole) {
            GenerateObjectDiffs(rightRole.username, leftRole.DefaultPrivileges, rightRole.DefaultPrivileges, Diffs);
        } else {
            GenerateObjectDiffs(rightRole.username, [], rightRole.DefaultPrivileges, Diffs);
        };
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
