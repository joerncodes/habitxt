import { Command } from "commander";

const scripts: Record<string, string> = {
  zsh: `#compdef habitxt

_habitxt_habits() {
  local -a habits
  habits=(\${(f)"$(habitxt _list 2>/dev/null)"})
  _describe 'habit' habits
}

_habitxt() {
  if [[ $CURRENT -eq 2 ]]; then
    local -a cmds
    cmds=(
      'do:Mark a habit as done'
      'fail:Fail today early (red [f] in today until midnight)'
      'show:Show habit details and streaks'
      'archive:Archive a habit'
      'hide:Hide a habit from month and today'
      'unhide:Show a hidden habit again'
      'month:Show monthly dashboard'
      'year:Calendar year heatmap (all habits)'
      'streak:Rank habits by current streak'
      'day:Interactive day view (optional date phrase)'
      'today:Alias for day (today)'
      'yesterday:Open day view for yesterday'
      'create:Create a new habit interactively'
      'completions:Output shell completion script'
    )
    _describe 'command' cmds
  elif [[ $CURRENT -eq 3 ]]; then
    case $words[2] in
      do|show|archive|hide|unhide|fail)
        _habitxt_habits
        ;;
    esac
  fi
}

_habitxt "$@"`,

  bash: `_habitxt_habits() {
  local habits
  habits=$(habitxt _list 2>/dev/null)
  COMPREPLY=($(compgen -W "$habits" -- "\${COMP_WORDS[COMP_CWORD]}"))
}

_habitxt() {
  local cmd="\${COMP_WORDS[1]}"
  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=($(compgen -W "do fail show archive hide unhide month year streak day today yesterday create completions" -- "\${COMP_WORDS[1]}"))
  elif [[ $COMP_CWORD -eq 2 && ( "$cmd" == "do" || "$cmd" == "fail" || "$cmd" == "show" || "$cmd" == "archive" || "$cmd" == "hide" || "$cmd" == "unhide" ) ]]; then
    _habitxt_habits
  fi
}

complete -F _habitxt habitxt`,

  fish: `function __habitxt_habits
  habitxt _list 2>/dev/null
end

complete -c habitxt -f
complete -c habitxt -n '__fish_use_subcommand' -a do      -d 'Mark a habit as done'
complete -c habitxt -n '__fish_use_subcommand' -a fail   -d 'Fail today early (red [f] in today until midnight)'
complete -c habitxt -n '__fish_use_subcommand' -a show    -d 'Show habit details and streaks'
complete -c habitxt -n '__fish_use_subcommand' -a archive -d 'Archive a habit'
complete -c habitxt -n '__fish_use_subcommand' -a hide    -d 'Hide a habit from month and today'
complete -c habitxt -n '__fish_use_subcommand' -a unhide  -d 'Show a hidden habit again'
complete -c habitxt -n '__fish_use_subcommand' -a month   -d 'Show monthly dashboard'
complete -c habitxt -n '__fish_use_subcommand' -a year    -d 'Calendar year heatmap (all habits)'
complete -c habitxt -n '__fish_use_subcommand' -a streak  -d 'Rank habits by current streak'
complete -c habitxt -n '__fish_use_subcommand' -a day     -d 'Interactive day view (optional date phrase)'
complete -c habitxt -n '__fish_use_subcommand' -a today   -d 'Alias for day (today)'
complete -c habitxt -n '__fish_use_subcommand' -a yesterday -d 'Open day view for yesterday'
complete -c habitxt -n '__fish_use_subcommand' -a create  -d 'Create a new habit interactively'
complete -c habitxt -n '__fish_use_subcommand' -a completions -d 'Output shell completion script'
complete -c habitxt -n '__fish_seen_subcommand_from do fail show archive hide unhide' -a '(__habitxt_habits)'`,
};

const installInstructions: Record<string, string> = {
  zsh: `# Add to ~/.zshrc (before sourcing oh-my-zsh):
#   export HABITXT_DIR="/path/to/your/habits"
#   fpath=(~/.zsh/completions $fpath)
# Then run once:
#   mkdir -p ~/.zsh/completions && habitxt completions > ~/.zsh/completions/_habitxt
#   rm -rf ~/.zcompdump* && exec zsh`,

  bash: `# Run once:
#   habitxt completions --shell bash >> ~/.bash_completion`,

  fish: `# Run once:
#   habitxt completions --shell fish > ~/.config/fish/completions/habitxt.fish`,
};

export function completionsCommand(program: Command) {
  program
    .command("completions")
    .description("Output shell completion script")
    .option("-s, --shell <shell>", "Shell type: zsh, bash, or fish", "zsh")
    .action((opts: { shell: string }) => {
      const shell = opts.shell.toLowerCase();
      if (!scripts[shell]) {
        console.error(`Unsupported shell: "${shell}". Choose zsh, bash, or fish.`);
        process.exit(1);
      }
      console.log(installInstructions[shell]);
      console.log(scripts[shell]);
    });
}
