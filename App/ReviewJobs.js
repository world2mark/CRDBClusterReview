'use strict';



const ClusterAPI = require('./ClusterAPI');



let ServicesObj;


const ReviewJobList = {};


class ReviewJob {


    #ReRunCaptures;
    #ForceTermination = false;
    #ReviewCompleted = false;
    #ReviewList = [];
    #ReviewUpdates = [];


    constructor(UserRefID, ReRunCaptures, ProfileList) {
        this.#ReviewList = ProfileList.map(profileName => ({
            user_ref_id: UserRefID,
            name: profileName
        }));

        this.#ReRunCaptures = ReRunCaptures;
    };


    TerminateReview() {
        this.#ForceTermination = true;
    };


    ApplyUpdate(updateString) {
        this.#ReviewUpdates.push({
            label: updateString,
            TS: Date.now(),
            Index: this.#ReviewUpdates.length
        });
        return new Promise(resolve => setTimeout(resolve, 333));
    };


    async RunReview() {
        if (!this.#ReRunCaptures) {
            this.#ReviewCompleted = true;
            this.#ReviewUpdates.push({
                label: 'Download links ready.',
                ReviewCompleted: true,
                TS: Date.now(),
                Index: this.#ReviewUpdates.length
            });
            return;
        };

        this.#ReviewUpdates.push({
            label: `Cluster review started`,
            TS: Date.now(),
            Index: this.#ReviewUpdates.length
        });

        let adminSQLClient;
        let targetSQLClient;

        try {

            await this.ApplyUpdate('SQL Client: Signing into administrative cluster.');
            adminSQLClient = await ServicesObj.ConnectionProfiles.CreateAdminClient();

            for (const activeProfile of this.#ReviewList) {

                activeProfile.StartTS = Date.now();

                await this.ApplyUpdate(`SQL Client: Signing into test cluster (<i>${activeProfile.name}</i>)`);
                targetSQLClient = await ServicesObj.ConnectionProfiles.CreateSpecificClient(activeProfile.name);

                await this.ApplyUpdate(`Cluster API: Signing into test cluster (<i>${activeProfile.name}</i>)`);
                const ProfileConnDetails = ServicesObj.ConnectionProfiles.GetSpecificProfile(activeProfile.name);
                const ApiSession = await ClusterAPI.SignIn(ProfileConnDetails.ConsoleUI);

                await this.ApplyUpdate('Cluster API: Getting node details');
                activeProfile.NodeDetails = await ClusterAPI.GetNodes(ProfileConnDetails.ConsoleUI, ApiSession);
                for (const nodeDetail of activeProfile.NodeDetails) {
                    delete nodeDetail.metrics;
                };

                await this.ApplyUpdate('SQL Client: Getting cluster settings');
                const clusterSettingsResultSet = await targetSQLClient.query('select variable,value from [show all cluster settings] order by variable;');
                activeProfile.ClusterSettings = clusterSettingsResultSet.rows;


                await this.ApplyUpdate('SQL Client: Getting databases');
                const databasesResultSet = await targetSQLClient.query('select * from crdb_internal.databases order by name;');
                activeProfile.Databases = databasesResultSet.rows;


                await this.ApplyUpdate('SQL Client: Getting users/roles');
                const rolesResultSet = await targetSQLClient.query('select * from [show roles] order by username;');
                activeProfile.Roles = rolesResultSet.rows;


                await this.ApplyUpdate('SQL Client: Getting node builds, IPs, locality, ranges, leases, etc');
                const gossipNodesResultSet = await targetSQLClient.query('select * from crdb_internal.gossip_nodes;');
                activeProfile.GossipNodes = gossipNodesResultSet.rows;

                await this.ApplyUpdate('SQL Client: Getting Node store IDs and counts');
                const nodeStoresResultSet = await targetSQLClient.query(`select node_id, store_id from crdb_internal.kv_store_status;`);
                activeProfile.NodeStores = nodeStoresResultSet.rows;


                await this.ApplyUpdate('SQL Client: Getting zone configurations');
                const zoneConfigResultSet = await targetSQLClient.query('select * from [show zone configurations] order by target;');
                activeProfile.ZoneConfigurations = zoneConfigResultSet.rows;


                await this.ApplyUpdate('SQL Client: Getting jobs');
                const jobsResultSet = await targetSQLClient.query('select * from [show jobs] order by job_type;');
                activeProfile.Jobs = jobsResultSet.rows;


                await this.ApplyUpdate('SQL Client: Getting schedules');
                const schedulesResultSet = await targetSQLClient.query('select * from [show schedules] order by label;');
                activeProfile.Schedules = schedulesResultSet.rows;


                activeProfile.EndTS = Date.now();

                this.#ReviewUpdates.push({
                    label: 'Cluster Review completed',
                    ReviewCompleted: true,
                    TS: activeProfile.EndTS,
                    Index: this.#ReviewUpdates.length
                });

                if (this.#ForceTermination) {
                    return;
                };

                await this.ApplyUpdate(`Saving review: ${activeProfile.name}`);

                await adminSQLClient.query('upsert into cluster_reviews (user_ref_id, cluster_name, last_updated, review_json) values ($1, $2, $3, $4);', [activeProfile.user_ref_id, activeProfile.name, new Date(activeProfile.EndTS), JSON.stringify(activeProfile)]);

            };

        } catch (err) {
            this.#ReviewUpdates.push({
                error: err.message,
                ReviewCompleted: true,
                TS: Date.now(),
                Index: this.#ReviewUpdates.length
            });
        } finally {
            if (adminSQLClient) {
                adminSQLClient.end();
            };

            if (targetSQLClient) {
                targetSQLClient.end();
            };

            this.#ReviewCompleted = true;
        };
    };


    GetReviewUpdates() {
        return this.#ReviewUpdates;
    };


    get ReviewCompleted() {
        return this.#ReviewCompleted;
    };


};



exports.CreateReviewJob = (UserRefID, ReRunCaptures, profileList) => {
    if (ReviewJobList[UserRefID]) {
        ReviewJobList[UserRefID].TerminateReview();
    };
    ReviewJobList[UserRefID] = new ReviewJob(UserRefID, ReRunCaptures, profileList);
    ReviewJobList[UserRefID].RunReview();
};



exports.GetReviewUpdates = UserRefID => {
    if (ReviewJobList[UserRefID]) {
        return {
            ReviewUpdates: ReviewJobList[UserRefID].GetReviewUpdates(),
            ReviewCompleted: ReviewJobList[UserRefID].ReviewCompleted
        };
    };

    return {
        Error: 'No review job running'
    };
};



exports.InitializeDB = async Services => {
    ServicesObj = Services;
    const myClient = await ServicesObj.ConnectionProfiles.CreateAdminClient();
    try {
        await myClient.query('select * from cluster_reviews limit 1;');
    } catch (err) {
        if (err.code !== '42P01') {
            throw err;
        };
        await myClient.query('create table cluster_reviews (user_ref_id string, cluster_name string, last_updated timestamp, review_json jsonb not null, primary key (user_ref_id, cluster_name));');
    } finally {
        await myClient.end();
    };
};



exports.GetReviewHeaders = async UserRefID => {
    const myClient = await ServicesObj.ConnectionProfiles.CreateAdminClient();
    try {
        const resultSet = await myClient.query('select cluster_name, last_updated from cluster_reviews where user_ref_id=$1;', [UserRefID]);
        return resultSet.rows;
    } finally {
        await myClient.end();
    };

};



exports.GetFullReviews = async (UserRefID, ClusterNameArray) => {
    const myClient = await ServicesObj.ConnectionProfiles.CreateAdminClient();
    try {
        if (ClusterNameArray) {
            const myStringProfiles = JSON.parse(ClusterNameArray).join(',');
            const resultSet = await myClient.query('select * from cluster_reviews where user_ref_id=$1 and cluster_name in (select unnest(string_to_array($2, \',\')))', [UserRefID, myStringProfiles]);
            return resultSet.rows;
        } else {
            const resultSet = await myClient.query('select * from cluster_reviews where user_ref_id=$1;', [UserRefID]);
            return resultSet.rows;
        };
    } finally {
        await myClient.end();
    };

};


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


function GenerateClusterSettingDiffs(ReviewList) {
    const Diffs = [];

    for (const leftReviewObj of ReviewList) {
        const LeftReview = leftReviewObj.review_json.ClusterSettings;
        for (const rightReviewObj of ReviewList) {
            const RightReview = rightReviewObj.review_json.ClusterSettings;

            if (LeftReview === RightReview) {
                continue;
            };

            for (const leftSetting of LeftReview) {

                const rightSetting = RightReview.find(item => item.variable === leftSetting.variable);
                if (rightSetting) {
                    if (leftSetting.value !== rightSetting.value) {

                        const existingItem = Diffs.find(csDiff => csDiff.ProfileCSVariable === leftSetting.variable);
                        if (!existingItem) {
                            const ValuesArrayByProfile = [];
                            for (const loopReview of ReviewList) {
                                const foundItem = loopReview.review_json.ClusterSettings.find(item => item.variable === leftSetting.variable);
                                if (foundItem) {
                                    if (foundItem.value.constructor === String && foundItem.value.trim().length === 0) {
                                        foundItem.value = '<i style=\"color: red;\">&lt;empty string&gt;</i>';
                                    };
                                    // The "replace" is needed because EJS appends funny characters in the render...
                                    ValuesArrayByProfile.push(foundItem.value.replace('µ', '&micro;'));
                                } else {
                                    ValuesArrayByProfile.push('<i style=\"color: red;\">&lt;missing&gt;</i>');
                                };
                            };
                            Diffs.push({
                                Summary: leftSetting.variable,
                                ProfileCSVariable: leftSetting.variable,
                                ProfileCSValue: ValuesArrayByProfile
                            });
                        };
                    };
                } else {
                    const existingItem = Diffs.find(csDiff => csDiff.ProfileCSVariable === leftSetting.variable);
                    if (!existingItem) {
                        const ValuesArrayByProfile = [];
                        for (const loopReview of ReviewList) {
                            const foundItem = loopReview.review_json.ClusterSettings.find(item => item.variable === leftSetting.variable);
                            if (foundItem) {
                                if (foundItem.value.constructor === String && foundItem.value.trim().length === 0) {
                                    foundItem.value = '<i style=\"color: red;\">&lt;empty string&gt;</i>';
                                };
                                // The "replace" is needed because EJS generates funny characters in the render...
                                ValuesArrayByProfile.push(foundItem.value.replace('µ', '&micro;'));
                            } else {
                                ValuesArrayByProfile.push('<i style=\"color: red;\">&lt;missing&gt;</i>');
                            };
                        };
                        Diffs.push({
                            Summary: leftSetting.variable,
                            ProfileCSVariable: leftSetting.variable,
                            ProfileCSValue: ValuesArrayByProfile
                        });
                    };
                };
            };
        };
    };
    return Diffs;
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


exports.GenerateHTML = async (UserRefID, profiles) => {

    const PATH = require('path');
    const FS = require('fs');
    const EJS = require('ejs');

    const ReviewList = await exports.GetFullReviews(UserRefID, profiles);
    const EJSTemplate = FS.readFileSync(PATH.join(__dirname, 'review-template.ejs'), 'utf8');


    const ClusterProfileNames = ReviewList.map(profile => ({
        name: profile.cluster_name,
        last_updated: profile.last_updated
    }));

    const dateNow = new Date();

    const resultHTML = EJS.render(EJSTemplate, {
        ReportRunDate: `${dateNow.toLocaleString()} (${dateNow.toUTCString()})`,
        ProfileNames: ClusterProfileNames,
        ClusterSettingDiffs: GenerateClusterSettingDiffs(ReviewList),
        GossipNodes: GenerateGossipNodeDiffs(ReviewList),
        NodeStores: GenerateNodeStoreDiffs(ReviewList)
    });

    return resultHTML;
};
