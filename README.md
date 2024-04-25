# CRDBClusterReview

This service captures the current state of cluster from a platform, configuration, and metadata perspective. It generates a document that summarizes database cluster that lets you report on how it may be changing over time. This is ideal to identify outdated settings or trends how a cluster may have been augmented. The output of this service is also used to compare multiple clusters to validate and differentiate settings when deploying dev, test, staging, and production deployments.


## Prerequisites
1 - __NodeJS 20__ must be installed (an older version probably works fine)
2 - __NPM install__ needs to be run if you don't have the node_modules


## To Run

### Step 1: Configuration file

This is just an example of what the 
```
{
    "LeftCluster": {
        "ConnName": "Sample Cluster (eg: QA/dev)",
        "ConnSQL": "postgresql://uid:pw@mycluster-qa-endpoint.com:26257/defaultdb",
        "ConnUI": "https://uid:pw@mycluster-qa-endpoint.com",
        "CA": "/some-path-to/my/ca.crt"
    },
    "RightCluster": {
        "ConnName": "Sample Cluster (eg: Prod Env)",
        "ConnSQL": "postgresql://uid:pw@mycluster-prod-endpoint.com:26257/defaultdb",
        "ConnUI": "https://uid:pw@mycluster-prod-endpoint.com",
        "CA": "/some-other-path-to/this/ca.crt"
    }
}
```


### Step 2: Run commands

You can run it directly: __*node App*__

You can run it via NPM: __*NPM start*__


## Results

2 files are created, suffixed with a timestamp:

1 - CRDB-Compare-Results-1714074196668.html
- This is the HTML-formatted results

2 - CRDB-Compare-Results-1714074196668.json
- This is the raw JSON that you can apply for further, offline investigation
