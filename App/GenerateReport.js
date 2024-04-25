'use strict';



function UnionOfKeys(keyArray1, keyArray2) {
    const obj = {};
    for (let i = keyArray1.length - 1; i >= 0; --i)
        obj[keyArray1[i]] = keyArray1[i];
    for (let i = keyArray2.length - 1; i >= 0; --i)
        obj[keyArray2[i]] = keyArray2[i];
    let res = [];
    for (let k in obj) {
        if (obj.hasOwnProperty(k))  // <-- optional
            res.push(obj[k]);
    };
    return res;
};




// Diffs include:
// 1) build_tag & server_version inconsistencies (within-cluster and across-clusters)
// 2) locality inconsistencies (missing/incorrect)
// 3) node-count inconsistencies
function GenerateGossipNodeDiffs(ReviewList) {
    const Diffs = [];

    const IGNORE = 'IGNORE';
    const STR_CHECK = 'STR_CHECK';
    const EACH_MUST_EXIST = 'EACH_MUST_EXIST';
    const ARR_CHECK = 'ARR_CHECK';

    const GossipNodeExpectations = {
        address: IGNORE, // eg: '10.100.239.83:31950'
        advertise_address: IGNORE, // eg: '10.100.239.83:31950'
        advertise_sql_address: IGNORE, // eg: '10.100.239.83:26257'
        attrs: ARR_CHECK, // eg: [], and this will stringify it
        build_tag: STR_CHECK, // eg: 'v23.1.8'
        cluster_name: STR_CHECK, // eg: ''
        is_live: IGNORE, // eg: true
        leases: IGNORE, // eg: '18'
        locality: EACH_MUST_EXIST, // eg: 'country=US,region=US-East,zone=Zone-1'
        network: STR_CHECK, // eg: 'tcp'
        node_id: IGNORE, // eg: '1'
        ranges: IGNORE, // eg: '84'
        server_version: STR_CHECK, // eg: '23.1'
        sql_address: IGNORE, // eg: '10.100.239.83:26257'
        sql_network: STR_CHECK, // eg: 'tcp'
        started_at: IGNORE, // eg: '2023-09-08T20:44:04.926Z'
    };

    function IterateUniqueGossipNodePairs(func) {
        for (let outerReviewIndex = 0; outerReviewIndex < ReviewList.length - 1; outerReviewIndex++) {
            for (let innerReviewIndex = outerReviewIndex + 1; innerReviewIndex < ReviewList.length; innerReviewIndex++) {
                const outerReview = ReviewList[outerReviewIndex];
                const innerReview = ReviewList[innerReviewIndex];
                for (const outer_node of outerReview.review_json.GossipNodes) {
                    for (const inner_node of innerReview.review_json.GossipNodes) {
                        func(theReview.cluster_name, gossip_Node);
                    };
                };
            };
        };
    };

    function IterateEveryGossipNode(func) {
        for (const theReview of ReviewList) {
            for (const gossip_Node of theReview.review_json.GossipNodes) {
                func(theReview.cluster_name, gossip_Node);
            };
        };
    };

    const localities = {};

    IterateEveryGossipNode((source_cluster, source_node) => {
        IterateEveryGossipNode((target_cluster, target_node) => {
            if (source_cluster === target_cluster) {
                return;
            };

            // localities
            if (!localities[source_node.locality]) {
                localities[source_node.locality] = {
                    cluster_name: source_node.locality,
                    node_count: 0
                };
            };
            const source_node_locality = localities[source_node.locality];
            source_node_locality.node_count++;
        });
    });

    const testLeftClusterName = 'AURACODA';
    const testRightClusterName = 'LOCALHOST';

    Diffs.push(`Mismatch of CRDB versions within the cluster <span class="highlight_cluster">${testLeftClusterName}</span>.`);
    Diffs.push(`Mismatch of CRDB versions between cluster <span class="highlight_cluster">${testLeftClusterName}</span> and <span class="highlight_cluster">${testRightClusterName}</span>`);
    Diffs.push(`The cluster <span class="highlight_cluster">${testLeftClusterName}</span> is missing the locality <span class="highlight_issue">Country=CAD;Zone=ON</span> found in cluster <span class="highlight_cluster">${testRightClusterName}</span>.`);
    Diffs.push(`The cluster <span class="highlight_cluster">${testRightClusterName}</span> is missing the locality <span class="highlight_issue">Country=USA;Zone=NY</span> found in cluster <span class="highlight_cluster">${testLeftClusterName}</span>.`);
    Diffs.push(`The cluster <span class="highlight_cluster">${testLeftClusterName}</span> is using <span class="highlight_issue">UDP</span> instead of <span class="highlight_issue">TCP</span> for node_id 1`);
    Diffs.push(`The cluster <span class="highlight_cluster">${testRightClusterName}</span> is using <span class="highlight_issue">UDP</span> instead of <span class="highlight_issue">TCP</span> for node_id 4`);
    return Diffs;
};


// Explore node & store inconsistencies
function GenerateNodeStoreDiffs(ReviewList) {

};


exports.GenerateHTML = async ReviewsToCompare => {

    const PATH = require('path');
    const FS = require('fs');
    const EJS = require('ejs');

    const EJSTemplate = FS.readFileSync(PATH.join(__dirname, 'template.ejs'), 'utf8');

    const dateNow = new Date();

    const ClusterObjNames = [
        {
            Data: {
                review_data: {
                    ConnName: ReviewsToCompare.LeftCluster.ConnName
                },
                saved_ts: dateNow
            },
            ConnName: ReviewsToCompare.LeftCluster.ConnName,
            TheTS: dateNow
        },
        {
            Data: {
                review_data: {
                    ConnName: ReviewsToCompare.RightCluster.ConnName
                },
                saved_ts: dateNow
            },
            ConnName: ReviewsToCompare.RightCluster.ConnName,
            TheTS: dateNow
        }
    ];

    const LeftReview = ReviewsToCompare.LeftCluster.Fragments;
    const RightReview = ReviewsToCompare.RightCluster.Fragments;

    const ClusterSettings = require('./ClusterSettings');
    const ClusterSettingDiffsJSON = ClusterSettings.GenerateDiffs(
        LeftReview,
        RightReview);
    const ClusterSettingDiffsHTML = ClusterSettings.GenerateHTML(
        ClusterObjNames,
        ClusterSettingDiffsJSON);


    const ZoneConfigs = require('./ZoneConfigs');
    const ZoneConfigDiffsJSON = ZoneConfigs.GenerateDiffs(
        LeftReview,
        RightReview);
    const ZoneConfigDiffsHTML = ZoneConfigs.GenerateHTML(
        ClusterObjNames,
        ZoneConfigDiffsJSON);


    const Schedules = require('./Schedules');
    const ScheduleDiffsJSON = Schedules.GenerateDiffs(
        LeftReview,
        RightReview);
    const ScheduleDiffsHTML = Schedules.GenerateHTML(
        ClusterObjNames,
        ScheduleDiffsJSON);


    const Changefeeds = require('./Changefeeds');
    const ChangefeedDiffsJSON = Changefeeds.GenerateDiffs(
        LeftReview,
        RightReview);
    const ChangefeedDiffsHTML = Changefeeds.GenerateHTML(
        ClusterObjNames,
        ChangefeedDiffsJSON);


    const Roles = require('./Roles');
    const RoleDiffsJSON = Roles.GenerateDiffs(
        LeftReview,
        RightReview);
    const RoleDiffsHTML = Roles.GenerateHTML(
        ClusterObjNames,
        RoleDiffsJSON);

    const Grants = require('./Grants');
    const GrantDiffsJSON = Grants.GenerateDiffs(
        LeftReview,
        RightReview);
    const GrantDiffsHTML = Grants.GenerateHTML(
        ClusterObjNames,
        GrantDiffsJSON);

    const SystemGrants = require('./SystemGrants');
    const SystemGrantDiffsJSON = SystemGrants.GenerateDiffs(
        LeftReview,
        RightReview);
    const SystemGrantDiffsHTML = SystemGrants.GenerateHTML(
        ClusterObjNames,
        SystemGrantDiffsJSON);


    const DefaultPrivileges = require('./DefaultPrivileges');
    const DefaultPrivilegeDiffsJSON = DefaultPrivileges.GenerateDiffs(
        LeftReview,
        RightReview);
    const DefaultPrivilegeDiffsHTML = DefaultPrivileges.GenerateHTML(
        ClusterObjNames,
        DefaultPrivilegeDiffsJSON);


    const Enums = require('./Enums');
    const EnumDiffsJSON = Enums.GenerateDiffs(
        LeftReview,
        RightReview);
    const EnumDiffsHTML = Enums.GenerateHTML(
        ClusterObjNames,
        EnumDiffsJSON);


    const Functions = require('./Functions');
    const FunctionDiffsJSON = Functions.GenerateDiffs(
        LeftReview,
        RightReview);
    const FunctionDiffsHTML = Functions.GenerateHTML(
        ClusterObjNames,
        FunctionDiffsJSON);


    const Sequences = require('./Sequences');
    const SequenceDiffsJSON = Sequences.GenerateDiffs(
        LeftReview,
        RightReview);
    const SequenceDiffsHTML = Sequences.GenerateHTML(
        ClusterObjNames,
        SequenceDiffsJSON);


    const Tables = require('./Tables');
    const TableDiffsJSON = Tables.GenerateDiffs(
        LeftReview,
        RightReview);
    const TableDiffsHTML = Tables.GenerateHTML(
        ClusterObjNames,
        TableDiffsJSON);


    const resultHTML = EJS.render(EJSTemplate, {
        ReportRunDate: `${dateNow.toLocaleString()} (${dateNow.toUTCString()})`,
        ReviewsToCompare: ClusterObjNames,
        DiffTopics: [
            ClusterSettingDiffsHTML,
            ZoneConfigDiffsHTML,
            ScheduleDiffsHTML,
            ChangefeedDiffsHTML,
            RoleDiffsHTML,
            GrantDiffsHTML,
            SystemGrantDiffsHTML,
            DefaultPrivilegeDiffsHTML,
            EnumDiffsHTML,
            FunctionDiffsHTML,
            SequenceDiffsHTML,
            TableDiffsHTML
        ]
    });

    return resultHTML;
};
