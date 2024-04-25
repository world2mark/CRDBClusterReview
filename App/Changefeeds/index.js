'use strict';



exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragment = LeftReview.find(fragment => fragment.fragment_name === 'Changefeeds');
    const LeftItems = LeftFragment.review_data.Changefeeds;

    const RightFragment = RightReview.find(fragment => fragment.fragment_name === 'Changefeeds');
    const RightItems = RightFragment.review_data.Changefeeds;

    for (const leftZone of LeftItems) {
        if (leftZone.PleaseIgnore === true) {
            continue;
        };

        const rightZone = RightItems.find(item => item.description === leftZone.description);
        if (rightZone) {
            if (rightZone.PleaseIgnore === true) {
                continue;
            };

            if (leftZone.description !== rightZone.description) {
                rightZone.PleaseIgnore = true;
                Diffs.push({
                    DiffLeftVal: leftZone.description,
                    DiffRightVal: rightZone.description
                });
            };
        } else {
            Diffs.push({
                DiffLeftVal: leftZone.description,
                DiffRightVal: '<i style=\"color: red;\">&lt;missing&gt;</i>'
            });
        };

        leftZone.PleaseIgnore = true;
    };

    for (const leftZone of RightItems) {
        if (leftZone.PleaseIgnore === true) {
            continue;
        };

        const rightZone = LeftItems.find(item => item.description === leftZone.description);
        if (!rightZone) {
            Diffs.push({
                DiffLeftVal: '<i style=\"color: red;\">&lt;missing&gt;</i>',
                DiffRightVal: leftZone.description
            });
        };

        leftZone.PleaseIgnore = true;
    };

    Diffs.sort((v1, v2) => {
        if (v1.description < v2.description) {
            return -1;
        };
        if (v1.description > v2.description) {
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
