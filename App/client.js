'use strict';


const ServiceObj = AMC.ServiceScriptObj;


let ReviewListData = [];


function CreateAgoString(TimestampTest) {
    const MinutesAgo = Math.round((Date.now() - TimestampTest) / (1000 * 60));
    const hoursAgo = Math.round(MinutesAgo / 60);

    if (hoursAgo === 0) {
        if (MinutesAgo < 1) {
            return 'few seconds ago';
        } else if (MinutesAgo === 1) {
            return '1 minute ago';
        } else {
            return `${MinutesAgo} minutes ago`;
        };
    } else if (hoursAgo === 1) {
        return '1 hour ago';
    } else if (hoursAgo < 48) {
        return `${hoursAgo} hours ago`;
    } else {
        return `${Math.round(hoursAgo / 24)} days ago`;
    };

};


function DisableUIButtons() {
    const CaptureReviewBtn = ACJS.GetObj('CaptureReviewBtn');
    CaptureReviewBtn.button('option', 'disabled', true);

    const runClusterReview = ACJS.GetObj('runClusterReview');
    runClusterReview.button('option', 'disabled', true);

    const deleteClusterReviews = ACJS.GetObj('deleteClusterReviews');
    deleteClusterReviews.button('option', 'disabled', true);
};


function RestoreUIButtons() {
    const CaptureReviewText = ACJS.GetObj('CaptureReviewText');
    const CaptureReviewBtn = ACJS.GetObj('CaptureReviewBtn');
    const LastCaptureTS = ACJS.GetObj('LastCaptureTS');
    const runClusterReview = ACJS.GetObj('runClusterReview');
    const deleteClusterReviews = ACJS.GetObj('deleteClusterReviews');
    const DeleteReviewsBtnText = ACJS.GetObj('DeleteReviewsBtnText');

    const profileObj = AMC.GetService('ConnectionProfiles').GetCurrentProfile();

    if (profileObj) {
        let buttonText = profileObj.ConnName;
        if (buttonText.length > 35) {
            buttonText = `${buttonText.substring(0, 32)}...`;
        };
        CaptureReviewText.html(`<span style="font-weight: normal;">Capture cluster data</span><br>${buttonText}`);
        CaptureReviewBtn.button('option', 'disabled', false);
        const pastReviews = ReviewListData.filter(item => item._conn_key === profileObj.ConnUUID);
        if (pastReviews.length === 0) {
            LastCaptureTS.html('Last capture: never!');
        } else {
            LastCaptureTS.html(`Last capture: ${new Date(pastReviews[0].saved_ts).toLocaleString()} (${CreateAgoString(pastReviews[0].saved_ts)})`);
            // array[0] because it's ordered desc from CRDB (therefore latest TS) 
        };
    } else {
        CaptureReviewText.html('Select connection (above)');
        CaptureReviewBtn.button('option', 'disabled', true);
        LastCaptureTS.html('');
    };

    const selectedItems = ReviewListData.filter(item => item.Selected);
    if (selectedItems.length === 0) {
        runClusterReview.button('option', 'disabled', true);
        deleteClusterReviews.button('option', 'disabled', true);
        DeleteReviewsBtnText.html('Delete ...');
    } else {
        if (selectedItems.length === 2) {
            runClusterReview.button('option', 'disabled', false);
        } else {
            runClusterReview.button('option', 'disabled', true);
        };

        if (selectedItems.length === 1) {
            DeleteReviewsBtnText.html('Delete this capture');
        } else {
            DeleteReviewsBtnText.html(`Delete ${selectedItems.length} captures`);
        };
        deleteClusterReviews.button('option', 'disabled', false);
    };

    for (const listItemData of ReviewListData) {
        const lastUpdatedEntry = ACJS.GetObj(listItemData.lastCapID);
        lastUpdatedEntry.html(`${new Date(listItemData.saved_ts).toLocaleString()}<br>${CreateAgoString(listItemData.saved_ts)}`);
    };
};


async function LoadReviews() {
    const SelectableReviewList = ACJS.GetObj('SelectableReviewList');
    SelectableReviewList.empty();

    const OldReviews = ReviewListData;

    ReviewListData = await ACJS.ManagedAJAXGet(ServiceObj.ServiceURL, ServiceObj.TabSpinnerID, {
        id: 'list-cluster-reviews'
    });

    for (const listItemData of ReviewListData) {
        listItemData.Selected = false;
        listItemData.myID = ACJS.NextID('reviewItem');
        listItemData.lastCapID = ACJS.NextID('lastCaptureTime');

        const ReviewListItemDOM = [];
        ReviewListItemDOM.push(`<li id="${listItemData.myID}" class="myAnimation ui-widget-content SelectableItem" style="padding: 0em; align-items: center;"><table style="width: 100%;"><tr>`);
        if (listItemData.PrivateProfile) {
            ReviewListItemDOM.push(`<td><img src="${AMC.StaticFilesURL}?folder=images&id=/private-conn.png" style="height: 24px"></td>`);
        } else {
            ReviewListItemDOM.push(`<td><img src="${AMC.StaticFilesURL}?folder=images&id=/public-conn.png" style="height: 24px"></td>`);
        };
        ReviewListItemDOM.push(`<td style="width: 100%; text-align: left;">${listItemData.ConnName}</td>`);



        ReviewListItemDOM.push(`<td style="width: 100%"><span id="${listItemData.lastCapID}" style="color: #888888; font-size: 0.75em; text-align: right;">${new Date(listItemData.saved_ts).toLocaleString()}<br>${CreateAgoString(listItemData.saved_ts)}</span></td>`);

        ReviewListItemDOM.push('</td></tr></table></li>');
        SelectableReviewList.append(ReviewListItemDOM.join(''));
    };

    const newReviewDOMIDs = [];

    for (const ReviewListItem of ReviewListData) {
        const foundOldReview = OldReviews.find(item => item._review_id === ReviewListItem._review_id);
        if (!foundOldReview) {
            ACJS.GetObj(ReviewListItem.myID).addClass('OrangeBackground');
            newReviewDOMIDs.push(ReviewListItem.myID);
        };
    };

    if (newReviewDOMIDs.length > 0) {
        setTimeout(() => {
            for (const myID of newReviewDOMIDs) {
                ACJS.GetObj(myID).removeClass('OrangeBackground');
            };
        }, 500);
    };

    SelectableReviewList.selectable({
        selected: function (event, ui) {
            const myListItem = ReviewListData.find(item => item.myID === ui.selected.id);
            if (myListItem) {

                if (myListItem.Selected) {
                    ACJS.GetObj(myListItem.myID).removeClass('ac-selected');
                    myListItem.Selected = false;
                } else {
                    myListItem.Selected = true;
                    ACJS.GetObj(myListItem.myID).addClass('ac-selected');
                };
            };

            RestoreUIButtons();
        }
    });
};

ServiceObj.Init = () => {

    const runClusterReview = ACJS.GetObj('runClusterReview');
    runClusterReview.button();

    let generatingReport = false;

    runClusterReview.click(async () => {
        if (generatingReport) {
            return;
        };

        generatingReport = true;

        DisableUIButtons();

        try {
            const ReviewsToCompare = ReviewListData.filter(item => item.Selected);

            const results = await ACJS.ManagedAJAXPost(`${ServiceObj.ServiceURL}?id=generate-report`, ServiceObj.TabSpinnerID, {
                ReviewsToCompare: ReviewsToCompare.map(item => ({
                    _conn_key: item._conn_key,
                    _review_id: item._review_id
                }))
            });

            const summaryWindow = window.open();
            summaryWindow.document.write(results);
        } catch (err) {
            // Do nothing, already informed user
        } finally {
            generatingReport = false;
            $('#prl_spinner').css('display', 'none');
            RestoreUIButtons();
        };
    });

    const CaptureReviewBtn = ACJS.GetObj('CaptureReviewBtn');

    CaptureReviewBtn.button();

    let capturingCluster = false;

    CaptureReviewBtn.click(async () => {
        try {
            if (capturingCluster) {
                return;
            };

            capturingCluster = true;

            DisableUIButtons();

            const profileObj = AMC.GetService('ConnectionProfiles').GetCurrentProfile();

            ACJS.GetObj(ServiceObj.TabSpinnerID).css('display', 'inline-block');
            ACJS.GetObj('CaptureReviewSpinner').css('display', 'inline-block');

            await ACJS.DelayPromise(100);

            await ACJS.ManagedAJAXGet(ServiceObj.ServiceURL, null, {
                id: 'capture-cluster-data',
                ConnUUID: profileObj.ConnUUID
            });

            const statusPopup = new ACJS.Popup({
                Width: 700,
                Title: `<div style="padding-left: 0.25em;height: 2em; line-height: 2em;"><span id="captureTitle" style="font-family: 'Trebuchet MS'; padding-left: 0.5em;">Capture Status (running)</span></div>`,
                TemplateDOM: CaptureStatusJobPopup,
                Background: '#ccddee'
            });
            await statusPopup.Open();

            await ACJS.DelayPromise(50);

            let jobRunning = true;
            do {
                await ACJS.DelayPromise(150);
                const JobStatuses = await ACJS.ManagedAJAXGet(ServiceObj.ServiceURL, null, {
                    id: 'GetUpdates'
                });

                for (const updateItem of JobStatuses) {
                    const dateString = new Date(updateItem.TS).toLocaleTimeString();
                    const CaptureStatusTable = ACJS.GetObj('CaptureStatusTable');

                    if (updateItem.Done) {
                        jobRunning = false;
                        if (updateItem.Failed) {
                            CaptureStatusTable.prepend(`<tr><td class="capture_status_left">${dateString}</td><td class="capture_status_right" style="color: #880000;">${updateItem.Label}</td></tr>`);
                            ACJS.GetObj('captureTitle').html('Metadata capture failed');
                            ACJS.GetObj('captureTitle').css('color', '#880000');
                        } else {
                            CaptureStatusTable.prepend(`<tr><td class="capture_status_left">${dateString}</td><td class="capture_status_right" style="color: #008800">${updateItem.Label}</td></tr>`);
                            ACJS.GetObj('captureTitle').html('Metadata capture completed');
                            ACJS.GetObj('captureTitle').css('color', '#008800');
                        };
                    } else {
                        CaptureStatusTable.prepend(`<tr><td class="capture_status_left">${dateString}</td><td class="capture_status_right">${updateItem.Label}</td></tr>`);
                    };
                };
            } while (jobRunning);

            await LoadReviews();

            const LastCaptureTS = ACJS.GetObj('LastCaptureTS');
            LastCaptureTS.html(`Last capture: ${new Date(ReviewListData[0].saved_ts).toLocaleString()} (${CreateAgoString(ReviewListData[0].saved_ts)})`);

        } finally {
            ACJS.GetObj(ServiceObj.TabSpinnerID).css('display', 'none');
            ACJS.GetObj('CaptureReviewSpinner').css('display', 'none');
            capturingCluster = false;
            RestoreUIButtons();
        };
    });


    const deleteClusterReviews = ACJS.GetObj('deleteClusterReviews');

    deleteClusterReviews.button();

    let deletetingReviews = false;

    deleteClusterReviews.click(async () => {
        try {
            if (deletetingReviews) {
                return;
            };

            const result = confirm(`Really delete these captures?`);
            if (!result) {
                return;
            };

            deletetingReviews = true;

            DisableUIButtons();

            const delete_cc_spinner = ACJS.GetObj('delete_cc_spinner');
            delete_cc_spinner.css('display', 'inline-block');

            const ReviewsToDelete = ReviewListData.filter(item => item.Selected);

            const results = await ACJS.ManagedAJAXPost(`${ServiceObj.ServiceURL}?id=delete-cluster-reviews`, ServiceObj.TabSpinnerID, {
                ReviewsToDelete: ReviewsToDelete.map(item => ({
                    _conn_key: item._conn_key,
                    _review_id: item._review_id
                }))
            });

            await LoadReviews();

            delete_cc_spinner.css('display', 'none');
        } finally {
            deletetingReviews = false;
            RestoreUIButtons();
        };
    });


    return LoadReviews();
};


ServiceObj.OnTabOpening = async () => {
    RestoreUIButtons();
};


ServiceObj.TabClosing = async () => {
    return true;
};


ServiceObj.ProfileConnChanged = () => {
    if (ServiceObj.TabIsOpen) {
        return ServiceObj.OnTabOpening();
    };
};


AMC.GetService('ConnectionProfiles').AddProfileChangeListener(ServiceObj.ProfileConnChanged);


AMC.ServiceScriptResolve();
