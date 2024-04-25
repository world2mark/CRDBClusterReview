'use strict';


const ClusterAPI = require('./ClusterAPI');
const PG = require('pg');

function ApplyUpdate(updateString) {
    console.log(`${new Date().toLocaleTimeString()} - ${updateString}`);
    return new Promise(resolve => setTimeout(resolve, 150));
};


exports.Run = async ClusterJSON => {

    const PGConfig = {
        ssl: {
        },
        connectionString: ClusterJSON.ConnSQL,
        max: 10, // MZMZ: 2022-10-03 (connection pooling issues... https://node-postgres.com/api/pool)
        idleTimeoutMillis: 10000 // 10 seconds
    };

    if (ClusterJSON.CA) {
        const FS = require('fs');
        PGConfig.ssl.ca = FS.readFileSync(ClusterJSON.CA);
    };

    if (ClusterJSON.key) {
        PGConfig.ssl.key = ClusterJSON.key;
    };

    if (ClusterJSON.cert) {
        PGConfig.ssl.cert = ClusterJSON.cert;
    };

    const PGPool = new PG.Pool(PGConfig);

    const PGClient = await PGPool.connect();

    try {

        ClusterJSON.Fragments = [];

        await ApplyUpdate(`SQL Client: Signing into test cluster \'${ClusterJSON.ConnName}\'`);

        if (ClusterJSON.ConnUI.length > 0) {
            await ApplyUpdate('Cluster API: Signing into test cluster');
            const ApiSession = await ClusterAPI.SignIn(ClusterJSON.ConnUI);

            if (ApiSession) {
                await ApplyUpdate('Cluster API: Getting node details');
                const MyNodeDetails = await ClusterAPI.GetNodes(ClusterJSON.ConnUI, ApiSession);
                for (const nodeDetail of MyNodeDetails) {
                    for (const storeMetrics of Object.entries(nodeDetail.store_metrics)) {
                        nodeDetail[`MZStoreData_${storeMetrics[0]}`] = {
                            Capacity: storeMetrics[1].capacity
                        };
                    };
                    delete nodeDetail.started_at;
                    delete nodeDetail.updated_at;
                    delete nodeDetail.store_metrics;
                    delete nodeDetail.metrics;
                };

                ClusterJSON.Fragments.push({
                    fragment_name: 'NodeDetails',
                    NodeDetails: MyNodeDetails
                });
            };
        };


        await ApplyUpdate('SQL Client: Getting cluster regions');
        const MyRegions = await PGClient.query(
            'select * from [show regions]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Regions',
            review_data: {
                Regions: MyRegions.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting cluster regions (all dbs)');
        const MyRegionsAllDBs = await PGClient.query(
            'select * from [show regions from all databases]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Regions (All Databases)',
            review_data: {
                RegionsAllDBs: MyRegionsAllDBs.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting cluster settings');
        const MyClusterSettings = await PGClient.query(
            'select variable,value from [show all cluster settings] order by variable');
        ClusterJSON.Fragments.push({
            fragment_name: 'Cluster Settings',
            review_data: {
                ClusterSettings: MyClusterSettings.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting databases');
        const MyDatabases = await PGClient.query(
            'select name,owner,primary_region,secondary_region, regions, survival_goal, placement_policy,create_statement from crdb_internal.databases');
        ClusterJSON.Fragments.push({
            fragment_name: 'Databases',
            review_data: {
                Databases: MyDatabases.rows
            }
        });

        const DBNameItemsFromConn = ClusterJSON.ConnSQL.split('/');
        ClusterJSON.ConnDBName = DBNameItemsFromConn[DBNameItemsFromConn.length - 1];

        if (!MyDatabases.rows.find(item => item.name === ClusterJSON.ConnDBName)) {
            throw new Error(`The connection string '${ClusterJSON.ConnSQL}' did not contain the database name '${ClusterJSON.ConnDBName}'.  Bug?`);
        };


        await ApplyUpdate('SQL Client: Getting tables');
        const MyTables = await PGClient.query(
            `select name,database_name,state,audit_mode,schema_name,locality from crdb_internal.tables where database_name=$1 and STATE <> 'DROP'`,
            [ClusterJSON.ConnDBName]);


        for (const myTable of MyTables.rows) {
            await ApplyUpdate(`SQL Client: Getting table definition: ${myTable.database_name}.${myTable.schema_name}.${myTable.name}`);
            const CreateStatementResultSet = await PGClient.query(
                `select create_statement from [show create ${myTable.schema_name}.${myTable.name}]`);
            myTable.create_statement = CreateStatementResultSet.rows[0].create_statement;
            ClusterJSON.Fragments.push({
                fragment_name: `Table: ${myTable.schema_name}.${myTable.name}`,
                review_data: myTable
            });
        };


        await ApplyUpdate('SQL Client: Getting enums');
        const MyEnums = await await PGClient.query(
            'select * from [show enums]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Enumerations',
            review_data: {
                Enumerations: MyEnums.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting sequences');
        const MySequences = await PGClient.query(
            'select * from [show sequences]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Sequences',
            review_data: {
                Sequences: MySequences.rows
            }
        });

        await ApplyUpdate('SQL Client: Getting external connections');
        const MyExtConnections = await PGClient.query(
            'select * from [SHOW CREATE ALL EXTERNAL CONNECTIONS]');
        ClusterJSON.Fragments.push({
            fragment_name: 'External Connections',
            review_data: {
                ExternalConnections: MyExtConnections.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting users/roles');
        const MyRolesUsers = await PGClient.query(
            'select * from [show roles] order by username');
        ClusterJSON.Fragments.push({
            fragment_name: 'Roles/Users',
            review_data: {
                RolesUsers: MyRolesUsers.rows
            }
        });


        const MyDefaultPrivileges = {
            Roles: []
        };

        await ApplyUpdate('SQL Client: default privileges (all roles)');
        const MyARDefaultPrivileges = await PGClient.query(
            'select * from [show default privileges for all roles]');
        MyDefaultPrivileges.AllRoles = MyARDefaultPrivileges.rows;

        for (const myRole of MyRolesUsers.rows) {
            await ApplyUpdate(`SQL Client: default privileges (${myRole.username})`);
            const resultSet = await PGClient.query(
                `select * from [show default privileges for role ${myRole.username}]`);
            MyDefaultPrivileges.Roles.push({
                username: myRole.username,
                DefaultPrivileges: resultSet.rows
            });
        }
        ClusterJSON.Fragments.push({
            fragment_name: 'Default Privileges',
            review_data: {
                DefaultPrivileges: MyDefaultPrivileges
            }
        });



        await ApplyUpdate('SQL Client: Getting grants');
        const MyGrants = await PGClient.query(
            'select * from [show grants]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Grants',
            review_data: {
                Grants: MyGrants.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting system grants');
        const MySystemGrants = await PGClient.query(
            'select * from [show system grants]');
        ClusterJSON.Fragments.push({
            fragment_name: 'System Grants',
            review_data: {
                SystemGrants: MySystemGrants.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting functions');
        const MyFunctions = await PGClient.query(
            'select * from [show functions]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Functions',
            review_data: {
                Functions: MyFunctions.rows
            }
        });


        try {
            // Test for Virtual Clusters
            await ApplyUpdate('SQL Client: Getting node builds, IPs, locality, ranges, leases, etc');
            const MyGossipNodes = await PGClient.query(
                'select * from crdb_internal.gossip_nodes');
            ClusterJSON.Fragments.push({
                fragment_name: 'Gossip Nodes',
                review_data: {
                    GossipNodes: MyGossipNodes.rows
                }
            });
        } catch (err) {
            if (err.code !== '0A000') {
                throw err;
            };
        };


        try {
            await ApplyUpdate('SQL Client: Getting Node store IDs and counts');
            const MyNodeStores = await PGClient.query(
                'select node_id, store_id from crdb_internal.kv_store_status');
            ClusterJSON.Fragments.push({
                fragment_name: 'Node Stores',
                review_data: {
                    NodeStores: MyNodeStores.rows
                }
            });
        } catch (err) {
            if (err.code !== '0A000') {
                throw err;
            };
        };


        await ApplyUpdate('SQL Client: Getting zone configurations');
        const MyZoneConfigs = await PGClient.query(
            'select * from [show zone configurations] order by target');
        ClusterJSON.Fragments.push({
            fragment_name: 'Zone Configurations',
            review_data: {
                ZoneConfigurations: MyZoneConfigs.rows
            }
        });


        // await ApplyUpdate('SQL Client: Getting jobs');
        // const jobsResultSet = await this.#AppServices.ConnectionProfiles.ConnProfileQuery(this.#UserIdentityKey, this.#ConnUUID, 'select * from [show jobs] order by job_type;');


        await ApplyUpdate('SQL Client: Getting schedules');
        const MySchedules = await PGClient.query(
            'select * from [show schedules] order by label');
        ClusterJSON.Fragments.push({
            fragment_name: 'Schedules',
            review_data: {
                Schedules: MySchedules.rows
            }
        });


        await ApplyUpdate('SQL Client: Getting changefeeds');
        const MyChangefeeds = await PGClient.query(
            'select * from [show changefeed jobs]');
        ClusterJSON.Fragments.push({
            fragment_name: 'Changefeeds',
            review_data: {
                Changefeeds: MyChangefeeds.rows
            }
        });


        await ApplyUpdate('Cluster Metadata capture completed', true, false);

    } finally {
        await PGClient.release();
    }
};
