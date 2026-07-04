<?php
/**
 * Dev-tools panel view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\DevTools\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the floating dev-tools panel: a collapsed "DEV" pill fixed to the
 * bottom-right corner that expands into a card with one section per sub-tool.
 * Today that is the battery-override section only; a second tool is another
 * section in this same markup, not a rework.
 *
 * The panel sits outside the `bsb/cockpit` block, so it carries its own
 * `data-wp-interactive="bsb/cockpit"` region but has no cockpit context — every
 * binding below reads shared `state` (never a `getContext()`-derived getter),
 * and every member it reads or writes carries the `devtools` prefix so it can
 * never collide with a production store member. It is escaped and pre-rendered
 * here, then interpolated as trusted markup by whichever surface (the cockpit
 * dashboard, the session detail screen) places it via the
 * `battery_surf_bench_devtools_panel` filter.
 */
class DevToolsPanelView implements View {

	/**
	 * Renders the panel body.
	 *
	 * @param array<string, mixed> $data {
	 *     Raw (translated) labels.
	 *
	 *     @type string $dev_label        Raw label on the collapsed pill.
	 *     @type string $title_label      Raw panel header title.
	 *     @type string $collapse_label   Raw accessible label for the collapse control.
	 *     @type string $battery_label    Raw battery section heading.
	 *     @type string $enable_label     Raw label for the battery section's enable toggle.
	 *     @type string $charging_group_label Raw accessible group label for the charging tri-state.
	 *     @type string $system_label     Raw label for the "follow system" charging choice.
	 *     @type string $charging_label   Raw label for the "force charging" choice.
	 *     @type string $discharging_label Raw label for the "force discharging" choice.
	 *     @type string $level_label      Raw label for the level-override toggle.
	 * }
	 * @return string The panel markup.
	 */
	public function render( array $data = array() ): string {
		$dev             = esc_html( (string) ( $data['dev_label'] ?? '' ) );
		$title           = esc_html( (string) ( $data['title_label'] ?? '' ) );
		$collapse        = esc_attr( (string) ( $data['collapse_label'] ?? '' ) );
		$battery         = esc_html( (string) ( $data['battery_label'] ?? '' ) );
		$enable          = esc_html( (string) ( $data['enable_label'] ?? '' ) );
		$charging_group  = esc_attr( (string) ( $data['charging_group_label'] ?? '' ) );
		$system          = esc_html( (string) ( $data['system_label'] ?? '' ) );
		$charging_choice = esc_html( (string) ( $data['charging_label'] ?? '' ) );
		$discharging     = esc_html( (string) ( $data['discharging_label'] ?? '' ) );
		$level           = esc_html( (string) ( $data['level_label'] ?? '' ) );

		return <<<HTML
<div class="bsb-devtools" data-wp-interactive="bsb/cockpit" data-wp-class--is-armed="state.devtools.battery.enabled" data-wp-watch---devtools-persist="callbacks.devtoolsPersist">
	<button type="button" class="bsb-devtools__pill" data-wp-on--click="actions.devtoolsToggleOpen" data-wp-bind--aria-expanded="state.devtools.open">
		<span class="bsb-devtools__pill-dot"></span>{$dev}
	</button>
	<div class="bsb-devtools__panel" hidden data-wp-bind--hidden="!state.devtools.open">
		<div class="bsb-devtools__header">
			<span>{$title}</span>
			<button type="button" class="bsb-devtools__collapse" data-wp-on--click="actions.devtoolsToggleOpen" aria-label="{$collapse}">&times;</button>
		</div>
		<div class="bsb-devtools__section" data-wp-class--is-disabled="!state.devtools.battery.enabled">
			<div class="bsb-devtools__section-head">
				<span>{$battery}</span>
				<label class="bsb-devtools__toggle">
					<input type="checkbox" data-wp-on--change="actions.devtoolsToggleBatteryEnabled" data-wp-bind--checked="state.devtools.battery.enabled" />
					{$enable}
				</label>
			</div>
			<div class="bsb-devtools__section-body">
				<div class="bsb-devtools__tristate" role="group" aria-label="{$charging_group}">
					<button type="button" class="bsb-devtools__choice" data-devtools-charging="system" data-wp-class--is-selected="state.devtoolsIsChargingSystem" data-wp-on--click="actions.devtoolsSetCharging">{$system}</button>
					<button type="button" class="bsb-devtools__choice" data-devtools-charging="charging" data-wp-class--is-selected="state.devtoolsIsChargingOn" data-wp-on--click="actions.devtoolsSetCharging">{$charging_choice}</button>
					<button type="button" class="bsb-devtools__choice" data-devtools-charging="discharging" data-wp-class--is-selected="state.devtoolsIsChargingOff" data-wp-on--click="actions.devtoolsSetCharging">{$discharging}</button>
				</div>
				<label class="bsb-devtools__toggle">
					<input type="checkbox" data-wp-on--change="actions.devtoolsToggleLevel" data-wp-bind--checked="state.devtoolsIsLevelForced" />
					{$level}
				</label>
				<div class="bsb-devtools__level">
					<input type="range" min="0" max="100" data-wp-bind--value="state.devtoolsLevelPercent" data-wp-on--input="actions.devtoolsSetLevel" />
					<span class="bsb-devtools__level-value" data-wp-text="state.devtoolsLevelPercent"></span>
				</div>
			</div>
		</div>
	</div>
</div>
HTML;
	}
}
