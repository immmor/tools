// Action: shrug (pose). Registers in window.RobotActions['shrug'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.shrug = {
    duration: Math.PI * 1.8,
    dynamic: false,
    update(ctx) {
        const { t, bones } = ctx;
        const { torsoGroup, headGroup, leftArm, rightArm } = bones;
        const shrugAmount = Math.sin(t * Math.PI) * 0.5;
        leftArm.shoulderPivot.rotation.z = shrugAmount;
        rightArm.shoulderPivot.rotation.z = -shrugAmount;
        leftArm.shoulderPivot.rotation.x = -0.2 * shrugAmount;
        rightArm.shoulderPivot.rotation.x = -0.2 * shrugAmount;
        leftArm.elbowPivot.rotation.x = 0.5 * shrugAmount;
        rightArm.elbowPivot.rotation.x = 0.5 * shrugAmount;
        headGroup.rotation.z = Math.sin(t * Math.PI * 2) * 0.2;
    }
};
