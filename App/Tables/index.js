'use strict';


exports.GenerateDiffs = (LeftReview, RightReview) => {
    const Diffs = [];

    const LeftFragments = LeftReview.filter(fragment => fragment.fragment_name.startsWith('Table: '));

    const RightFragments = RightReview.filter(fragment => fragment.fragment_name.startsWith('Table: '));

    for (const leftFragObj of LeftFragments) {
        const leftSetting = leftFragObj.review_data;

        if (leftSetting.name.includes('log_analytics')) {
            let a = 0;
            a++;
        };

        let rightFragObj = RightFragments.find(item => (item.review_data.name === leftSetting.name) && (item.review_data.schema_name === leftSetting.schema_name));

        if (!rightFragObj) {
            rightFragObj = RightFragments.find(item => item.review_data.name === leftSetting.name);
        };

        if (rightFragObj) {
            const rightSetting = rightFragObj.review_data;

            const leftSchema = leftSetting.schema_name;
            delete leftSetting.schema_name;
            const rightSchema = rightSetting.schema_name;
            delete rightSetting.schema_name;

            let leftCreateStmtWithSchema = leftSetting.create_statement;
            if (leftSetting.create_statement) {
                leftSetting.create_statement = leftSetting.create_statement.replaceAll('\n', '');
                leftCreateStmtWithSchema = leftSetting.create_statement.replaceAll('\t', '');
                leftSetting.create_statement = leftCreateStmtWithSchema.replace(`${leftSchema}.`, '');
            };

            let rightCreateStmtWithSchema = rightSetting.create_statement;
            if (rightSetting.create_statement) {
                rightSetting.create_statement = rightSetting.create_statement.replaceAll('\n', '');
                rightCreateStmtWithSchema = rightSetting.create_statement.replaceAll('\t', '');
                rightSetting.create_statement = rightCreateStmtWithSchema.replace(`${rightSchema}.`, '');
            };

            const DifferenceFound = (leftSetting.database_name) && (JSON.stringify(leftSetting) !== JSON.stringify(rightSetting));

            leftSetting.schema_name = leftSchema;
            leftSetting.create_statement = leftCreateStmtWithSchema;
            rightSetting.schema_name = rightSchema;
            rightSetting.create_statement = rightCreateStmtWithSchema;

            if (DifferenceFound) {
                Diffs.push({
                    TableName: `${leftSetting.database_name}.${leftSetting.name}`,
                    DiffLeftVal: JSON.stringify(leftSetting, null, 2),
                    DiffRightVal: JSON.stringify(rightSetting, null, 2),
                });
            };
        };
    };

    Diffs.sort((v1, v2) => {
        if (v1.TableName < v2.TableName) {
            return -1;
        };
        if (v1.TableName > v2.TableName) {
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
