$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navHeaders = $("#nav-headers");
  const $storiesBtn = $("#nav-stories");
  const $submitBtn = $("#nav-submit");
  const $favBtn = $("#nav-favorites");
  const $favoritedArticles = $("#favorited-articles");
  const $navName = $("#nav-user-profile");
  const $userProfile = $("#user-profile");
  const $profileBtn = $("#nav-user-profile");
  $userProfile.hide();
  
  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  // Event handler for favoriting stories
  // When a star is clicked, checks if story is favorited 
  // and calls method to add/remove story from array
  $("body").on("click", ".fa-star", async function(e) {
    if (currentUser) {
      const $icon = $(e.target).closest("i");
      const $closestStory = $(e.target).closest("li");
      const storyId = $closestStory.attr("id");
    
      if (currentUser.favorites.every(story => {return story.storyId !== storyId;})) {
        await currentUser.addFavorite(storyId);
        $icon.attr("class", "fas fa-star");
      } else {
        await currentUser.removeFavorite(storyId);
        $icon.attr("class", "far fa-star");
      }
    }
  })

  /**
   * Event handler for deleting stories
   * When a trash can is clicked, removes story from storyList and user.ownStories
   * Refreshes story list and returns screen to $allStoriesList
   */
  $("body").on("click", ".fa-trash-alt", async function(e) {
    const $story = $(e.target).closest("li").attr("id");
    await storyList.removeStory(currentUser, $story);
    hideElements();
    await generateStories()
    $allStoriesList.show();
  });

  // Event handler for clicking Submit on the nav-bar
  $submitBtn.on("click", function() {
    $submitForm.slideToggle();
  });

  // Event handler for clicking Favorites on the nav-bar
  $favBtn.on("click", function() {
    hideElements();
    showFavorites();
  });

  // Event handler for clicking My Stories on the nav-bar
  $storiesBtn.on("click", function() {
    hideElements();
    showMyStories();
  })

  // Event handler for clicking profile name on the nav-bar
  $profileBtn.on("click", function() {
    hideElements();
    showProfile();
  });

  /**
   * Event handler for submitting a story in the submit form
   * Calls addStory method on information from the form fields
   * creates HTML with information and prepends story to storyList
   */
  $submitForm.on("click", "#story-submit", async function(e) {
    e.preventDefault();

    const author = $("#author").val();
    const title = $("#title").val();
    const url = $("#url").val();
    $("#author").val("");
    $("#title").val("");
    $("#url").val("");

    const storyObj = {author, title, url};
    const res = await storyList.addStory(currentUser, storyObj);

    const $newLi = generateStoryHTML(storyObj);

    $allStoriesList.prepend($newLi);

    $submitForm.slideToggle();
    await generateStories();
    $allStoriesList.show();
  })

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);
    const starType = checkFavorite(story);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        <span id="icon">
          <i class="${starType} fa-star"></i>
        </span>
        <a class="article-link" href="${story.url}">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  // Checks if parameter story matches any stories in current user's favorites
  // Returns type of star based on result
  function checkFavorite(story) {
    if (currentUser) {
      const favs = currentUser.favorites;
      for(let fav of favs) {
        if (story.storyId === fav.storyId) return "fas";
      }
    }
    return "far"
  }
  
  /**
   * Creates HTML for each story in user's ownStories array
   * Changes all icons to trash cans to allow for deletion of own stories
   */
  function generateMyStories() {
    const myStoriesList = currentUser.ownStories;
    if (myStoriesList.length === 0) {
      const $noStories = $(`<h4>You haven't submitted any stories yet!</h4>`);
      $ownStories.append($noStories);
    }
    for (let story of myStoriesList) {
      const $newStory = generateStoryHTML(story);
      $ownStories.append($newStory);
      const $icons = $("i");
      $icons.attr("class", "fas fa-trash-alt");
    }
  }

  // Empties stories in $ownStories and creates new markup before showing $ownStories page
  function showMyStories() {
    $ownStories.empty();
    generateMyStories();
    hideElements();
    $ownStories.show()
  }

  // Creates HTML for each story in user's favorite articles
  function generateFavorites() {
    const myFavs = currentUser.favorites;
    if (myFavs.length === 0) {
      const $noFavs = $(`<h4>You haven't favorited any stories yet!</h4>`);
      $favoritedArticles.append($noFavs);
    }
    for (let story of myFavs) {
      const $newStory = generateStoryHTML(story);
      $favoritedArticles.append($newStory);
    }
  }

  // Empties favorite stories and creates new markup before showing $favoritedArticles page
  function showFavorites() {
    $favoritedArticles.empty();
    generateFavorites();
    hideElements();
    $favoritedArticles.show();
  }

  // Shows user profile information after adding information from currentUser data
  function showProfile() {
    $("#pName").text(currentUser.name);
    $("#pUser").text(currentUser.username);
    $("#pCreated").text(currentUser.createdAt);
    $userProfile.show();
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfile,
      $favoritedArticles
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  // Changes navbar for a logged in user, gives options to submit stories, favorite stories to
  // check out later, and check out submitted stories
  // Also shows name and (logout) on navbar instead of "login/create user"
  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navHeaders.show();
    $navName.text(currentUser.username);
    $("#nav-welcome").show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }

});