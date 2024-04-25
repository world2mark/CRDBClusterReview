'use strict';


function CleanUpSchedule(schedObj) {
    delete schedObj.created;
    delete schedObj.id;
    delete schedObj.jobsrunning;
    delete schedObj.next_run;
    delete schedObj.state;
    delete schedObj.command.protected_timestamp_record;
};


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Schedules');
    const LeftItems = LeftFragment.review_data.Schedules;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Schedules');
    const RightItems = RightFragment.review_data.Schedules;

    for (const leftSetting of LeftItems) {
        CleanUpSchedule(leftSetting);

        let rightSetting;

        if (leftSetting.command.backup_statement) {
            rightSetting = RightItems.find(item => item.command.backup_statement === leftSetting.command.backup_statement);
        } else if (leftSetting.label.startsWith('row-level-ttl: ')) {
            const labelParts = leftSetting.label.split(' ');
            rightSetting = RightItems.find(item => {
                const testParts = item.label.split(' ');
                if (testParts.length < 2) {
                    return false;
                };
                return labelParts[0] === testParts[0] && labelParts[1] === testParts[1];
            });
        } else {
            rightSetting = RightItems.find(item => item.label === leftSetting.label);
        };
        if (rightSetting) {
            if (rightSetting.PleaseIgnore === true) {
                continue;
            };

            CleanUpSchedule(rightSetting);

            if (JSON.stringify(leftSetting) !== JSON.stringify(rightSetting)) {
                Diffs.push({
                    DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                    DiffRightVal: JSON.stringify(rightSetting, null, 2),
                });
            };
            rightSetting.PleaseIgnore = true;
        } else {
            Diffs.push({
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

        CleanUpSchedule(leftSetting);

        let rightSetting;

        if (leftSetting.command.backup_statement) {
            rightSetting = LeftItems.find(item => item.command.backup_statement === leftSetting.command.backup_statement);
        } else if (leftSetting.label.startsWith('row-level-ttl: ')) {
            const labelParts = leftSetting.label.split(' ');
            rightSetting = LeftItems.find(item => {
                const testParts = item.label.split(' ');
                if (testParts.length < 2) {
                    return false;
                };
                return labelParts[0] === testParts[0] && labelParts[1] === testParts[1];
            });
        } else {
            rightSetting = LeftItems.find(item => item.label === leftSetting.label);
        };
        if (!rightSetting) {
            Diffs.push({
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: JSON.stringify(leftSetting, null, 2)
            });
        };


        leftSetting.PleaseIgnore = true;
    };


    // Removal of all the PleaseIgnore properties
    const cleanDiffs = Diffs.map(myDiff => ({
        DiffLeftVal: myDiff.DiffLeftVal,
        DiffRightVal: myDiff.DiffRightVal
    }));

    cleanDiffs.sort((v1, v2) => {
        if (v1.DiffLeftVal.command < v2.DiffLeftVal.command) {
            return -1;
        };
        if (v1.DiffLeftVal.command > v2.DiffLeftVal.command) {
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
