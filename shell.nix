let
  pkgs = import
    (builtins.fetchTarball {
      name = "nixos-unstable-2021-10-01";
      url = "https://github.com/nixos/nixpkgs/archive/d3d2c44a26b693293e8c79da0c3e3227fc212882.tar.gz";
      sha256 = "0vi4r7sxzfdaxzlhpmdkvkn3fjg533fcwsy3yrcj5fiyqip2p3kl";
    })
    { };

  local-node = pkgs.writeShellScriptBin "local-node" ''
    hardhat node
  '';

  compile = pkgs.writeShellScriptBin "compile" ''
    hardhat compile
  '';

  local-fork = pkgs.writeShellScriptBin "local-fork" ''
    hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/G0Vg_iZFiAuUD6hjXqcVg-Nys-NGiTQy --fork-block-number 11833335
  '';

  local-test = pkgs.writeShellScriptBin "local-test" ''
    hardhat test --network localhost
  '';

  prettier-check = pkgs.writeShellScriptBin "prettier-check" ''
    prettier --check .
  '';

  prettier-write = pkgs.writeShellScriptBin "prettier-write" ''
    prettier --write .
  '';

  ci-lint = pkgs.writeShellScriptBin "ci-lint" ''
    flush-all
    npm install
    solhint 'contracts/**/*.sol'
    prettier-check
    npm run lint
  '';

  flush-all = pkgs.writeShellScriptBin "flush-all" ''
    rm -rf artifacts
    rm -rf cache
    rm -rf node_modules
    rm -rf typechain
    rm -rf bin
    rm -rf docusaurus/.docusaurus
    rm -rf docusaurus/build
    rm -rf docusaurus/node_modules
    rm -rf docs/api
  '';

  security-check = pkgs.writeShellScriptBin "security-check" ''
    flush-all
    npm install

    # Run slither against all our contracts.
    # Disable npx as nix-shell already handles availability of what we need.
    # Dependencies and tests are out of scope.
    slither . --npx-disable --filter-paths="contracts/test" --exclude-dependencies
  '';

  solt-the-earth = pkgs.writeShellScriptBin "solt-the-earth" ''
    mkdir -p solt
    find contracts -type f -not -path 'contracts/test/*' | xargs -i solt write '{}' --npm --runs 100000
    for name in solc-* ; do  content=$(jq '.sources |= with_entries(.key |= sub("\\./"; ""))' "''${name}")
    cat <<< $content > "''${name}"; done
    mv solc-* solt
  '';

  cut-dist = pkgs.writeShellScriptBin "cut-dist" ''
    flush-all
    npm install

    hardhat compile --force
    dir=`git rev-parse HEAD`
    mkdir -p "dist/''${dir}"
    mv artifacts "dist/''${dir}/"
    mv typechain "dist/''${dir}/"

    solt-the-earth
    mv solt "dist/''${dir}/"
  '';

  ci-test = pkgs.writeShellScriptBin "ci-test" ''
    flush-all
    npm install
    hardhat compile --force
    hardhat test
  '';

  docgen = pkgs.writeShellScriptBin "docgen" ''
    rm -rf docs/api && npm run docgen
  '';

  docs-dev = pkgs.writeShellScriptBin "docs-dev" ''
    docgen && npm run start --prefix docusaurus
  '';

  docs-build = pkgs.writeShellScriptBin "docs-build" ''
    docgen && npm run build --prefix docusaurus
  '';

  docs-serve = pkgs.writeShellScriptBin "docs-serve" ''
    npm run serve --prefix docusaurus
  '';

  docs-version = pkgs.writeShellScriptBin "docs-version" ''
    docs-build && npm run docusaurus --prefix docusaurus docs:version ''${GIT_TAG}
    # build again so docusaurus-search-local can index newly added version
    npm run build --prefix docusaurus
  '';

  prepack = pkgs.writeShellScriptBin "prepack" ''
    set -euo pipefail
    shopt -s globstar

    flush-all

    npm install
    npm run build

    cp artifacts/contracts/**/*.json artifacts
    rm -rf artifacts/*.dbg.json
    rm -rf artifacts/*Test*
    rm -rf artifacts/*Reentrant*
    rm -rf artifacts/*ForceSendEther*
    rm -rf artifacts/*Mock*
  '';

  prepublish = pkgs.writeShellScriptBin "prepublish" ''
    npm version patch --no-git-tag-version
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    cat << EOF


    Package version for $PACKAGE_NAME bumped to $PACKAGE_VERSION

    Please manually commit this change, and push up to the GitHub repo:

    $ git commit -am "$PACKAGE_VERSION"
    $ git push

    Now, you should either:
    - tag this commit locally and push it up
    - remotely cut a release on the GitHub repo (if you're having issues tagging the commit locally)

    Locally:
    $ git tag v$PACKAGE_VERSION -am "$PACKAGE_VERSION"
    $ git push origin v$PACKAGE_VERSION

    Remotely:
    Go to Releases -> Draft a new release
    Select this branch and create a new release with the following tag: v$PACKAGE_VERSION


    EOF
  '';
in
pkgs.stdenv.mkDerivation {
  name = "shell";
  buildInputs = [
    pkgs.nixpkgs-fmt
    pkgs.yarn
    pkgs.nodejs-16_x
    pkgs.slither-analyzer
    compile
    local-node
    local-fork
    local-test
    prettier-check
    prettier-write
    security-check
    ci-test
    ci-lint
    cut-dist
    docgen
    docs-dev
    docs-build
    docs-serve
    docs-version
    prepack
    prepublish
    solt-the-earth
    flush-all
  ];

  shellHook = ''
    export PATH=$( npm bin ):$PATH
    # keep it fresh
    npm install
  '';
}
