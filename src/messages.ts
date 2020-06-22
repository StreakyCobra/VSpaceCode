import { ConfigurationTarget, env, extensions, Uri, window, workspace } from 'vscode';
import { ConfigKey, extensionId, spaceCmdId, VimConfigKey, vimExtensionId, vimExtensionQualifiedId, manualInstallUrl } from './constants';
import { Version, ComparisonResult } from './version';

interface VimKeyBinding {
    before: string[];
    after?: string[];
    commands?: string[];
}

const enum WelcomeSelection {
    SetupVim = "Automatically for Vim",
    Manually = "Manually",
}

const enum MissingVimSelection {
    Install = "Install",
    StopChecking = "Don't Check Again",
}
const enum MissingVimBindingSelection {
    Continue = "Continue",
    Manually = "Setup Manually",
    StopChecking = "Don't Check Again",
}

export async function showWelcomeMessage() {
    const selection = await window.showInformationMessage(
        "Welcome to VSpaceCode. How do you want to configure your key binding?",
        WelcomeSelection.Manually,
        WelcomeSelection.SetupVim,
    );

    switch (selection) {
        case WelcomeSelection.Manually:
            await env.openExternal(Uri.parse(manualInstallUrl));
            break;
        case WelcomeSelection.SetupVim:
            checkVim(true);
            break;
    }
}

function showMissingVimMessage(isNew: boolean) {
    const message = isNew ? "VSCode Vim is not installed." : "We detected VSCode Vim is not install.";
    return window.showWarningMessage(
        message,
        MissingVimSelection.StopChecking,
        MissingVimSelection.Install
    );
}

function showMissingBindingMessage(isNew: boolean) {
    let message = "Adding space key bindings automatically will reformat your vim key bindings in settings. Do you want to continue?";
    if (!isNew) {
        message = `VSpaceCode key bindings are not present in the VSCode Vim config. ${message}`;
    }

    return window.showWarningMessage(
        message,
        MissingVimBindingSelection.StopChecking,
        MissingVimBindingSelection.Manually,
        MissingVimBindingSelection.Continue
    );
}

export async function showUpdateMessage(cur: string, prev: string) {
    if (Version.compare(cur, prev) === ComparisonResult.Newer) {
        const changeLog = "Changelog";
        const selection = await window.showInformationMessage(
            `VspaceCode is updated to v${cur}. See what's new in the changelog.`,
            changeLog
        );
        if (selection === changeLog) {
            await env.openExternal(Uri.parse("https://github.com/VSpaceCode/VSpaceCode/blob/master/CHANGELOG.md"));
        }
    }
}

export async function checkVim(isNew = false) {
    const vspacecodeConfig = workspace.getConfiguration(extensionId);
    const shouldCheck = vspacecodeConfig.get(ConfigKey.CheckVimConfig);
    if (!shouldCheck) { return; }

    const vim = extensions.getExtension(vimExtensionQualifiedId);
    if (vim) {
        const vimConfig = workspace.getConfiguration(vimExtensionId);
        const normalBindings = vimConfig.get<VimKeyBinding[]>(VimConfigKey.NormalNonRecursive) ?? [];
        const visualBindings = vimConfig.get<VimKeyBinding[]>(VimConfigKey.VisualNonRecursive) ?? [];
        const hasNormalBinding = normalBindings.some(b => b.commands?.some(c => c === spaceCmdId));
        const hasVisualBinding = visualBindings.some(b => b.commands?.some(c => c === spaceCmdId));
        if (!hasNormalBinding || !hasVisualBinding) {
            const missingBindingSelection = await showMissingBindingMessage(isNew);
            switch (missingBindingSelection) {
                case MissingVimBindingSelection.Continue:
                    if (!hasNormalBinding) {
                        normalBindings.push({ "before": ["<space>"], "commands": [spaceCmdId] });
                        vimConfig.update(VimConfigKey.NormalNonRecursive, normalBindings, ConfigurationTarget.Global);
                    }
                    if (!hasVisualBinding) {
                        visualBindings.push({ "before": ["<space>"], "commands": [spaceCmdId] });
                        vimConfig.update(VimConfigKey.VisualNonRecursive, visualBindings, ConfigurationTarget.Global);
                    }
                    break;

                case MissingVimBindingSelection.Manually:
                    await env.openExternal(Uri.parse(manualInstallUrl));
                    break;

                case MissingVimBindingSelection.StopChecking:
                    vspacecodeConfig.update(ConfigKey.CheckVimConfig, false, ConfigurationTarget.Global);
                    break;
            }
        }
    } else {
        const missingVimSelection = await showMissingVimMessage(isNew);
        switch (missingVimSelection) {
            case MissingVimSelection.Install:
                await env.openExternal(Uri.parse("vscode:extension/vscodevim.vim"));
                break;

            case MissingVimSelection.StopChecking:
                vspacecodeConfig.update(ConfigKey.CheckVimConfig, false, ConfigurationTarget.Global);
                break;
        }
    }
}
