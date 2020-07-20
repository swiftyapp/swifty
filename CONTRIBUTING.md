# Contributing to Swifty

:tada: First off, thanks for taking the time to contribute! :tada:

This project adheres to the Contributor Covenant [code of conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code.

The following are guidelines for contributing to Swifty.
These are just guidelines, not rules, use your best judgment and feel free to
propose changes to this document in a pull request.

## [Issues](https://github.com/swiftyapp/swifty/issues)

Issues are created [here](https://github.com/swiftyapp/swifty/issues/new).

### Issue Maintenance and Closure
* If an issue is inactive for 45 days (no activity of any kind), it will be marked for closure with `stale`.
* If after this label is applied, no further activity occurs in the next 7 days, the issue will be closed.
* If an issue has been closed and you still feel it's relevant, feel free to ping a maintainer or add a comment!

## [Pull Requests](https://github.com/swiftyapp/swifty/pulls)

Pull Requests are the way concrete changes are made to the code, documentation,
dependencies, and tools contained in the `swiftyapp/swifty` repository.

* Setting up your local environment
  * Fork the project on GitHub and clone your fork locally.
  ```
  $ git clone git@github.com:swiftyapp/swifty.git
  $ cd swifty
  $ git remote add upstream https://github.com/swiftyapp/swifty.git
  $ git fetch upstream
  ```
  * Start app in development with:
  `bozon start`
  * Run Tests with:
  `yarn test`
  * To keep your development environment organized, create local branches to hold your work. These should be branched directly off of the master branch.
  ```
  $ git checkout -b my-branch -t upstream/master
  ```
* Making Changes
  * Make a change to the code
  * Commit your changes using [semantic commit messages](https://www.conventionalcommits.org/en/v1.0.0-beta.4/) to streamline the release process. A good commit message should describe what changed and why.
  * Once you have committed your changes, it is a good idea to use git rebase
  ```
  $ git fetch upstream
  $ git rebase upstream/master
  ```
  * Before submitting your changes in a pull request, always run the full test suite. To run the tests:
  ```
  yarn test
  ```

  * Once your commits are ready to go (with passing tests and linting) begin the process of opening a pull request by pushing your working branch to your fork on GitHub.
  * From within GitHub, opening a new pull request will present you with a template that should be filled out
  * Discuss changes and update pull request
