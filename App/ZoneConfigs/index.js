'use strict';



exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Zone Configurations');
    const LeftItems = LeftFragment.review_data.ZoneConfigurations;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Zone Configurations');
    const RightItems = RightFragment.review_data.ZoneConfigurations;

    for (const leftZone of LeftItems) {
        if (leftZone.PleaseIgnore === true) {
            continue;
        };

        const rightZone = RightItems.find(item => item.target === leftZone.target);
        if (rightZone) {
            if (rightZone.PleaseIgnore === true) {
                continue;
            };

            if (leftZone.raw_config_sql !== rightZone.raw_config_sql) {
                rightZone.PleaseIgnore = true;
                Diffs.push({
                    Target: leftZone.target,
                    LeftPre: true,
                    DiffLeftVal: leftZone.raw_config_sql,
                    RightPre: true,
                    DiffRightVal: rightZone.raw_config_sql
                });
            };
        } else {
            Diffs.push({
                Target: leftZone.target,
                LeftPre: true,
                DiffLeftVal: leftZone.raw_config_sql,
                DiffRightVal: '<i style=\"color: red;\">&lt;missing&gt;</i>'
            });
        };

        leftZone.PleaseIgnore = true;
    };

    for (const leftZone of RightItems) {
        if (leftZone.PleaseIgnore === true) {
            continue;
        };

        const rightZone = LeftItems.find(item => item.target === leftZone.target);
        if (!rightZone) {
            Diffs.push({
                Target: leftZone.target,
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                RightPre: true,
                DiffRightVal: leftZone.raw_config_sql
            });
        };

        leftZone.PleaseIgnore = true;
    };

    Diffs.sort((v1, v2) => {
        if (v1.Target < v2.Target) {
            return -1;
        };
        if (v1.Target > v2.Target) {
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
